import argparse
import base64
import copy
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from zipfile import ZipFile
from PIL import Image, ImageDraw
import yaml

from src.parse_tasks import parse_tasks
from src.validate_assets import extract_archive, validate_task, import_existing
from src.common import confined, atomic_json, read_json, digest
from src.image_provider import OpenAIProvider, ImageResult, ProviderError, with_retries
from src.image_processing import prepare_image, composite_product
from src.quality_check import check_image
from src.progress_tracker import Tracker, Budget, process_lock
from src.generate_images import generate_task
from src.update_content import replace_references, integration_plan, apply_plan
from src.render_charts import validate_data
from src.reports import package_completed, cost_estimate
from src.pipeline import run, paid_gate, production_fingerprint, local_jobs
from src.prompt_builder import build_prompt
from src.register_builtin import register_batch, copy_once

ROOT = Path(__file__).resolve().parents[1]
SETTINGS = yaml.safe_load((ROOT/'config/settings.yaml').read_text(encoding='utf-8'))
STYLES = yaml.safe_load((ROOT/'config/styles.yaml').read_text(encoding='utf-8'))
TEMPLATES = yaml.safe_load((ROOT/'config/prompt_templates.yaml').read_text(encoding='utf-8'))


def image_bytes(size=(640,360)):
    image=Image.new('RGB',size,'#FAF7F2')
    ImageDraw.Draw(image).rectangle((50,50,250,250),fill='#1F5C5C')
    stream=io.BytesIO()
    image.save(stream,'PNG')
    return stream.getvalue()


def sample_task(ident=1):
    return {'id':ident,'batch':'1','slug':'test','source_path':'src/content/blog/test/中文圖.png',
            'folder':'src/content/blog/test','type':'A','action':'新產','prompt':'test illustration',
            'filename':'中文圖.png','position':'封面','status':'READY','references':[]}


class TempCase(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.root=Path(self.tmp.name).resolve()
    def tearDown(self):
        self.tmp.cleanup()


class ParsingTests(unittest.TestCase):
    def test_real_221_excel_and_chinese(self):
        excel=ROOT/'inputs/excel/AGELOCKED-ChatGPT產圖清單.xlsx'
        tasks=parse_tasks(excel,ROOT.parent)
        self.assertEqual(len(tasks),221)
        self.assertEqual({k:sum(t['type']==k for t in tasks) for k in 'ABCD'},dict(A=71,B=123,C=17,D=10))
        self.assertEqual(sum('reuse_of' in t for t in tasks),4)
        self.assertEqual({t['reuse_of'] for t in tasks if 'reuse_of' in t},{31})
        self.assertTrue(any('蛤' in t['filename'] for t in tasks))
        self.assertTrue(tasks[37]['source_path'].startswith('src/content/blog/'))


class AssetTests(TempCase):
    def test_path_escape(self):
        for bad in ['../secret','C:/outside','/outside']:
            with self.assertRaises(ValueError):
                confined(self.root,bad)
    def test_zip_slip(self):
        archive=self.root/'bad.zip'
        with ZipFile(archive,'w') as z:
            z.writestr('../escape.txt','bad')
        with self.assertRaises(ValueError):
            extract_archive(archive,self.root/'unpacked')
        self.assertFalse((self.root/'escape.txt').exists())
    def test_zip_no_overwrite(self):
        archive=self.root/'safe.zip'
        with ZipFile(archive,'w') as z:
            z.writestr('a.txt','good')
        extract_archive(archive,self.root/'unpacked')
        extract_archive(archive,self.root/'unpacked')
        (self.root/'unpacked/a.txt').write_text('changed')
        with self.assertRaises(ValueError):
            extract_archive(archive,self.root/'unpacked')
    def test_missing_redraw_and_anchors(self):
        task=sample_task(); task.update(type='B',action='照原構圖重畫')
        validate_task(task,self.root,self.root,STYLES,SETTINGS,[task])
        self.assertEqual(task['status'],'BLOCKED')
        self.assertIn('ORIGINAL_IMAGE_MISSING',task['asset_reasons'])
    def test_chart_requires_confirmation(self):
        task=sample_task(); task['type']='C'
        validate_task(task,self.root,self.root,STYLES,SETTINGS,[task])
        self.assertEqual(task['status'],'REVIEW_REQUIRED')
    def test_product_requires_official(self):
        task=sample_task(); task['type']='D'
        validate_task(task,self.root,self.root,STYLES,SETTINGS,[task])
        self.assertIn('OFFICIAL_PRODUCT_PHOTO_MISSING',task['asset_reasons'])
    def test_existing_not_invented(self):
        (self.root/'inputs/existing_images').mkdir(parents=True)
        self.assertEqual(import_existing([sample_task()],self.root)['notice'],'EXISTING_IMAGE_NOT_FOUND')
    def test_existing_mapping_not_complete(self):
        folder=self.root/'inputs/existing_images'; folder.mkdir(parents=True)
        (folder/'draft.png').write_bytes(image_bytes())
        atomic_json(folder/'manifest.json',{'1':{'file':'inputs/existing_images/draft.png','mapped_by':'human'}})
        task=sample_task()
        import_existing([task],self.root)
        self.assertEqual(task['status'],'GENERATED')


class ImageTests(TempCase):
    def test_png_webp_chinese_dimensions(self):
        source=self.root/'原圖.png'; source.write_bytes(image_bytes())
        png,webp=self.root/'中文.png',self.root/'中文.webp'
        prepare_image(source,png,webp,(2400,1260))
        for path in [png,webp]:
            self.assertTrue(check_image(path,(2400,1260))['passed_technical'])
        with self.assertRaises(ValueError):
            prepare_image(source,png,webp,(2400,1260))
    def test_blank_corrupt_missing(self):
        blank=self.root/'blank.png'; Image.new('RGB',(30,30),'white').save(blank)
        self.assertIn('BLANK_OR_NEAR_UNIFORM',check_image(blank,(30,30))['errors'])
        blank.write_bytes(b'bad')
        self.assertIn('IMAGE_UNREADABLE',check_image(blank,(30,30))['errors'])
        self.assertIn('FILE_MISSING',check_image(self.root/'absent',(30,30))['errors'])
    def test_product_composition(self):
        bg=self.root/'bg.png'; bg.write_bytes(image_bytes())
        official=self.root/'official.png'
        image=Image.new('RGBA',(100,100),(0,0,0,0)); ImageDraw.Draw(image).rectangle((20,10,80,90),fill='red'); image.save(official)
        out=self.root/'out.png'; composite_product(bg,official,out)
        self.assertTrue(out.exists())
        with Image.open(out) as result:
            pixels=result.get_flattened_data() if hasattr(result,'get_flattened_data') else result.getdata()
            self.assertTrue(any(r>240 and g<10 and b<10 for r,g,b,a in pixels))


class ProviderTests(TempCase):
    def test_generation_http_and_decode(self):
        seen=[]
        class Response:
            headers={'x-request-id':'mock-request'}
            def __enter__(self): return self
            def __exit__(self,*args): pass
            def read(self): return json.dumps({'data':[{'b64_json':base64.b64encode(image_bytes()).decode()}],'usage':{}}).encode()
        def transport(request,timeout):
            seen.append(request)
            return Response()
        with patch.dict(os.environ,{'OPENAI_API_KEY':'test-secret-never-log'}):
            result=OpenAIProvider(SETTINGS,transport).generate('draw',[])
            self.assertTrue(result.image.startswith(b'\x89PNG'))
            self.assertTrue(seen[0].full_url.endswith('/generations'))
            self.assertEqual(json.loads(seen[0].data)['model'],'gpt-image-2')
            source=self.root/'reference.png'; source.write_bytes(image_bytes())
            OpenAIProvider(SETTINGS,transport).generate('edit',[str(source)])
            self.assertTrue(seen[1].full_url.endswith('/edits'))
            self.assertIn(b'name="image[]"',seen[1].data)
    def test_retry_is_bounded(self):
        calls=[]
        def fail():
            calls.append(1); raise ProviderError('RATE_LIMIT',retryable=True)
        delays=[]
        with self.assertRaises(ProviderError):
            with_retries(fail,3,sleep=delays.append)
        self.assertEqual(len(calls),4)
        self.assertEqual(len(delays),3)
    def test_timeout_never_blind_retry(self):
        calls=[]
        def fail():
            calls.append(1); raise ProviderError('UNKNOWN',ambiguous=True,retryable=True)
        with self.assertRaises(ProviderError): with_retries(fail,3,sleep=lambda _:None)
        self.assertEqual(len(calls),1)
    def test_retry_after_is_minimum_and_long_deferred(self):
        attempts=iter([0,1]); delays=[]
        def call():
            if next(attempts)==0: raise ProviderError('RATE',retryable=True,retry_after=7)
            return 'ok'
        self.assertEqual(with_retries(call,1,sleep=delays.append),'ok')
        self.assertGreaterEqual(delays[0],7)
        with self.assertRaises(ProviderError):
            with_retries(lambda: (_ for _ in ()).throw(ProviderError('RATE',retryable=True,retry_after=90)),3,sleep=delays.append)


class StateAndBudgetTests(TempCase):
    def test_budget_reservations_persist_and_stop(self):
        budget=Budget(self.root,.5,.25)
        budget.reserve(1,'mock'); budget.reserve(2,'mock')
        with self.assertRaises(ValueError): budget.reserve(3,'mock')
        self.assertEqual(Budget(self.root,.5,.25).exposure(),.5)
    def test_unknown_usage_keeps_reserve(self):
        budget=Budget(self.root,1,.25); entry=budget.reserve(1,'mock')
        budget.settle(entry,ImageResult(b'',{},None,'mock'),SETTINGS['pricing'])
        self.assertIsNone(entry['token_cost_usd'])
        self.assertEqual(budget.exposure(),.25)
    def test_token_cost_formula(self):
        budget=Budget(self.root,1,.25); entry=budget.reserve(1,'mock')
        usage={'input_tokens_details':{'text_tokens':1000,'image_tokens':2000},'output_tokens':3000}
        budget.settle(entry,ImageResult(b'',usage,None,'mock'),SETTINGS['pricing'])
        self.assertAlmostEqual(entry['token_cost_usd'],.111)
    def test_interrupted_billing_blocks_new_requests(self):
        Budget(self.root,1,.25).reserve(1,'mock')
        recovered=Budget(self.root,1,.25)
        with self.assertRaises(ValueError): recovered.reserve(2,'mock')
    def test_resume_completed_preserved_interruption_held(self):
        first,second=sample_task(),sample_task(2)
        tracker=Tracker(self.root,[first,second]); tracker.update(first,'COMPLETED'); tracker.update(second,'GENERATING')
        recovered=Tracker(self.root,[sample_task(),sample_task(2)])
        self.assertEqual(recovered.tasks[0]['status'],'COMPLETED')
        self.assertEqual(recovered.tasks[1]['status'],'REVIEW_REQUIRED')
    def test_real_generation_pipeline_with_mock_only(self):
        task=sample_task(); tracker=Tracker(self.root,[task]); budget=Budget(self.root,1,.25)
        class Mock:
            def generate(self,*args): return ImageResult(image_bytes(),{},'mock','mock')
        generate_task(task,self.root,SETTINGS,STYLES,TEMPLATES,Mock(),tracker,budget)
        self.assertEqual(task['status'],'REVIEW_REQUIRED')
        self.assertTrue((self.root/task['png']).exists())
        with self.assertRaises(ValueError):
            generate_task(task,self.root,SETTINGS,STYLES,TEMPLATES,Mock(),tracker,budget)
    def test_saved_raw_recovers_without_second_api_call(self):
        task=sample_task(); tracker=Tracker(self.root,[task]); budget=Budget(self.root,1,.25)
        calls=[]
        class Mock:
            def generate(self,*args):
                calls.append(1)
                return ImageResult(image_bytes(),{},'mock','mock')
        with patch('src.generate_images.prepare_image',side_effect=OSError('simulated interrupted processing')):
            with self.assertRaises(ValueError):
                generate_task(task,self.root,SETTINGS,STYLES,TEMPLATES,Mock(),tracker,budget)
        local_jobs([task],self.root,self.root,SETTINGS,STYLES,tracker)
        self.assertEqual(len(calls),1)
        self.assertTrue((self.root/task['webp']).exists())
        self.assertEqual(task['status'],'REVIEW_REQUIRED')
    def test_paid_gate_requires_explicit_consent(self):
        settings=copy.deepcopy(SETTINGS); settings.update(dry_run=False,existing_drafts_resolved=True)
        with self.assertRaises(ValueError): paid_gate(self.root,settings,[sample_task()])
    def test_paid_scope_and_first_trial(self):
        settings=copy.deepcopy(SETTINGS); settings.update(dry_run=False,existing_drafts_resolved=True)
        tasks=[sample_task(i) for i in range(1,5)]
        atomic_json(self.root/'config/approval.json',{'approved_by':'tester','recorded_at':'now','budget_usd':10,
                    'fingerprints':{str(t['id']):production_fingerprint(t,settings) for t in tasks}})
        paid_gate(self.root,settings,tasks[:3])
        with self.assertRaises(ValueError): paid_gate(self.root,settings,tasks)
        tasks[0]['prompt']='changed'
        with self.assertRaises(ValueError): paid_gate(self.root,settings,tasks[:1])


class IntegrationAndReportsTests(TempCase):
    def test_shared_cover_and_body_are_updated_separately(self):
        text="---\nslug: same\nheroImage: './same.png'\n---\n![figure](./same.png)\n"
        cover=replace_references(text,'./same.png','./cover.webp','封面')
        self.assertIn('![figure](./same.png)',cover)
        body=replace_references(text,'./same.png','./body.webp','內文 1')
        self.assertIn("heroImage: './same.png'",body)
        self.assertIn('![figure](./body.webp)',body)
    def test_markdown_exact_references_preserve_prose(self):
        text="---\nslug: same\nheroImage: './圖(1).png'\n---\n文字 圖(1).png\n![示意](./圖(1).png)\n"
        result=replace_references(text,'./圖(1).png','./新圖.webp')
        self.assertIn('slug: same',result)
        self.assertIn('文字 圖(1).png',result)
        self.assertIn('![示意](./新圖.webp)',result)
        self.assertIn("heroImage: './新圖.webp'",result)
    def test_integration_preserves_original_and_backups(self):
        repo=self.root/'site'; folder=repo/'src/content/blog/test'; folder.mkdir(parents=True)
        article=folder/'index.md'; article.write_text("---\nslug: test\nheroImage: './中文圖.png'\n---\n文章\n",encoding='utf-8')
        old=folder/'中文圖.png'; old.write_bytes(image_bytes())
        new=self.root/'outputs/webp/new.webp'; new.parent.mkdir(parents=True); new.write_bytes(b'new')
        task=sample_task(); task.update(status='APPROVED',webp='outputs/webp/new.webp')
        plan=integration_plan([task],self.root,repo)
        self.assertIn('中文圖-agelocked-001.webp',plan['patch'])
        self.assertNotIn('agelocked',article.read_text(encoding='utf-8'))
        before=old.read_bytes(); apply_plan(plan,self.root,repo)
        self.assertEqual(old.read_bytes(),before)
        self.assertTrue(list((self.root/'outputs/backups').rglob('index.md')))
    def test_changed_article_is_not_overwritten(self):
        path=self.root/'index.md'; path.write_text('original')
        plan={'hashes':{str(path):digest(path)},'assets':[],'documents':{str(path):'updated'}}
        path.write_text('user change')
        with self.assertRaises(ValueError): apply_plan(plan,self.root,self.root)
        self.assertEqual(path.read_text(),'user change')
    def test_zip_completeness_no_secrets(self):
        task=sample_task(); task.update(status='COMPLETED',png='outputs/png/x.png',webp='outputs/webp/x.webp')
        for key in ['png','webp']:
            p=self.root/task[key]; p.parent.mkdir(parents=True,exist_ok=True); p.write_bytes(image_bytes())
        (self.root/'.env').write_text('OPENAI_API_KEY=test-secret')
        destination=self.root/'done.zip'; package_completed(self.root,[task],destination)
        with ZipFile(destination) as z:
            self.assertEqual(set(z.namelist()),{'manifest.json','outputs/png/x.png','outputs/webp/x.webp'})
            self.assertIsNone(z.testzip())
    def test_unapproved_not_packaged(self):
        destination=self.root/'empty.zip'; package_completed(self.root,[sample_task()],destination)
        with ZipFile(destination) as z:
            self.assertEqual(len(z.namelist()),1)
    def test_science_no_imputation(self):
        with self.assertRaises(ValueError): validate_data({'title':'unknown'})
        data={'source':'paper','confirmed_by':'human','title':'study','x_label':'time','y_label':'value','unit':'mg','labels':['a'],
              'series':[{'name':'group','values':[None]}]}
        with self.assertRaises(ValueError): validate_data(data)
        data['series'][0]['values']=[1]; validate_data(data)
        data['series'][0]['errors']=[.1]
        with self.assertRaises(ValueError): validate_data(data)

    def test_forest_uses_exact_asymmetric_confidence_intervals(self):
        data={'source':'verified paper','confirmed_by':'user','title':'PCGrimAge','x_label':'difference','y_label':'clock','unit':'years/year',
              'kind':'forest','labels':['PCGrimAge'],'error_definition':'published 95% CI',
              'series':[{'name':'MVM vs placebo','values':[-.113],'intervals':[[-.205,-.020]]}]}
        validate_data(data)
        data['series'][0]['intervals']=[[-.1,-.02]]
        with self.assertRaises(ValueError):validate_data(data)


class OfflineTests(TempCase):
    def test_full_dry_run_has_no_network_or_provider(self):
        # Real supplied workbook; mock network creation as a tripwire.
        (self.root/'config').mkdir()
        for filename in ['settings.yaml','styles.yaml','prompt_templates.yaml']:
            (self.root/'config'/filename).write_bytes((ROOT/'config'/filename).read_bytes())
        excel=self.root/'inputs/excel'; excel.mkdir(parents=True)
        (excel/'AGELOCKED-ChatGPT產圖清單.xlsx').write_bytes((ROOT/'inputs/excel/AGELOCKED-ChatGPT產圖清單.xlsx').read_bytes())
        args=argparse.Namespace(inspect=False,dry_run=True,resume=False,report=False,package=False,approve=False,
                               approve_cost=False,trial_passed=False,integrate_preview=False,integrate=False,
                               confirm_site_changes=False,batch=None,slug=None,task_ids=None,limit=None,force=False,reviewed_by=None)
        with patch('src.pipeline.create_provider',side_effect=AssertionError('NETWORK_FORBIDDEN')),patch('urllib.request.urlopen',side_effect=AssertionError('NETWORK_FORBIDDEN')),patch('builtins.print'):
            summary=run(self.root,args)
        self.assertEqual(summary['total'],221)
        self.assertEqual(summary['immediately_generatable'],0)
        self.assertFalse((self.root/'tasks/cost_ledger.json').exists())


class BuiltinImportTests(TempCase):
    def test_body_import_requires_no_text_and_verified_original(self):
        (self.root/'config').mkdir()
        (self.root/'config/styles.yaml').write_bytes((ROOT/'config/styles.yaml').read_bytes())
        original=self.root/'native.png'; original.write_bytes(image_bytes())
        task=sample_task(); task.update(type='B',position='內文 1',action='照原構圖重畫',source_path=original.name,article_title='title')
        manifest={'user_approved_count':1,'title_policy':'body_no_text','jobs':[{'id':1,'source':str(original),
                  'title_lines':[],'text_policy':'no_text','reference_sha256':'wrong','title_edit_prompt':'test'}]}
        with patch('src.register_builtin.load_settings',return_value=SETTINGS),patch('src.register_builtin.parse_tasks',return_value=[task]),patch('src.register_builtin.confined',side_effect=lambda root,path:self.root/path if path==original.name else Path(root)/path):
            with self.assertRaises(ValueError): register_batch(self.root,manifest)
            manifest['jobs'][0]['reference_sha256']=digest(original)
            result=register_batch(self.root,manifest)
        self.assertEqual(result[0]['status'],'REVIEW_REQUIRED')
        self.assertEqual(result[0]['title_lines'],[])
        self.assertIn('body_text',result[0]['qa'])

    def test_cover_prompt_contains_complete_title_and_two_line_rule(self):
        task=sample_task(); task['article_title']='完整文章標題，不能省略'
        prompt=build_prompt(task,TEMPLATES)
        self.assertIn(task['article_title'],prompt)
        self.assertIn('TWO lines',prompt)
    def test_existing_registry_recognizes_output_folder_sources(self):
        folder=self.root/'outputs/png'; folder.mkdir(parents=True)
        (folder/'old.png').write_bytes(image_bytes())
        atomic_json(self.root/'inputs/existing_images/manifest.json',{'1':{'file':'outputs/png/old.png','mapped_by':'Codex visual match'}})
        task=sample_task()
        result=import_existing([task],self.root)
        self.assertEqual(result['files_found'],1)
        self.assertEqual(result['registered_task_ids'],[1])
        self.assertEqual(task['status'],'GENERATED')
        self.assertEqual(import_existing([task],self.root)['mapped_task_ids'],[])
        self.assertEqual(cost_estimate([task],SETTINGS)['potential_api_jobs'],0)
    def test_builtin_import_is_nonbillable_reviewable_and_idempotent(self):
        (self.root/'config').mkdir()
        (self.root/'config/styles.yaml').write_bytes((ROOT/'config/styles.yaml').read_bytes())
        original=self.root/'native.png'; original.write_bytes(image_bytes())
        task=sample_task(); task['article_title']='完整文章標題'
        manifest={'user_approved_count':1,'title_policy':'full_article_title_max_two_lines',
                  'jobs':[{'id':1,'source':str(original),'title_lines':['完整文章','標題'],'title_edit_prompt':'test','history':[]}]}
        with patch('src.register_builtin.load_settings',return_value=SETTINGS),patch('src.register_builtin.parse_tasks',return_value=[task]):
            tasks=register_batch(self.root,manifest)
            before=digest(self.root/tasks[0]['png'])
            register_batch(self.root,manifest)
        self.assertEqual(tasks[0]['status'],'REVIEW_REQUIRED')
        self.assertEqual(tasks[0]['independent_api_calls'],0)
        self.assertEqual(before,digest(self.root/tasks[0]['png']))
        self.assertFalse((self.root/'tasks/cost_ledger.json').exists())
    def test_copy_never_overwrites_different_image(self):
        a,b=self.root/'a.png',self.root/'b.png'
        a.write_bytes(image_bytes()); b.write_bytes(b'existing user file')
        with self.assertRaises(ValueError): copy_once(a,b)
        self.assertEqual(b.read_bytes(),b'existing user file')


if __name__=='__main__':
    unittest.main()
