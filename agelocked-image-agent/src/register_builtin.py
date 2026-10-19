"""Register actual Codex built-in image outputs. This module never generates or bills images."""
import json
import shutil
from pathlib import Path
from PIL import Image
import yaml
from .common import atomic_json, read_json, confined, digest, output_file, now, load_settings
from .parse_tasks import parse_tasks
from .progress_tracker import Tracker, process_lock
from .image_processing import prepare_image, dimensions
from .quality_check import check_image


def copy_once(source,destination):
    source,destination=Path(source),Path(destination)
    if destination.exists():
        if digest(source)!=digest(destination):
            raise ValueError('BUILTIN_IMPORT_WOULD_OVERWRITE')
        return
    destination.parent.mkdir(parents=True,exist_ok=True)
    with source.open('rb') as inp, destination.open('xb') as out:
        shutil.copyfileobj(inp,out)


def register_batch(root,manifest):
    root=Path(root).resolve()
    settings=load_settings(root)
    styles=yaml.safe_load((root/'config/styles.yaml').read_text(encoding='utf-8'))
    tasks=parse_tasks(root/settings['excel'],root.parent,settings['expected_tasks'])
    ids=[job['id'] for job in manifest['jobs']]
    if len(ids)!=len(set(ids)) or len(ids)!=manifest['user_approved_count']:
        raise ValueError('BUILTIN_BATCH_COUNT_MISMATCH')
    # Validate all sources and title bindings before any import or state mutation.
    for job in manifest['jobs']:
        task=next(t for t in tasks if t['id']==job['id'])
        if task['type']=='A':
            if not 1<=len(job.get('title_lines',[]))<=2:
                raise ValueError('BUILTIN_COVER_POLICY_MISMATCH')
            normalize=lambda v:''.join(v.split())
            if normalize(''.join(job['title_lines']))!=normalize(task.get('article_title','')):
                raise ValueError('BUILTIN_TITLE_IS_NOT_COMPLETE_ARTICLE_TITLE')
        elif task['type']=='B':
            if job.get('title_lines') or job.get('text_policy')!='no_text':
                raise ValueError('BUILTIN_BODY_MUST_BE_TEXT_FREE')
            if '照原構圖' in task['action']:
                reference=confined(root.parent,task['source_path'])
                if not reference.is_file() or job.get('reference_sha256')!=digest(reference):
                    raise ValueError('BUILTIN_REDRAW_REFERENCE_REQUIRED')
        else:
            raise ValueError('BUILTIN_REQUIRES_ILLUSTRATION_TASK')
        with Image.open(job['source']) as im:
            im.verify()
        for path in job.get('history',[]):
            with Image.open(path) as im:
                im.verify()
    with process_lock(root):
        tracker=Tracker(root,tasks)
        atomic_json(root/'outputs/reports/builtin-before-import.json',tracker.tasks)
        for job in manifest['jobs']:
            task=next(t for t in tracker.tasks if t['id']==job['id'])
            if task['status'] in {'APPROVED','COMPLETED'}:
                raise ValueError('CANNOT_REPLACE_APPROVED_TASK')
            raw=confined(root,f"outputs/raw/codex-builtin/{task['id']:03d}/{task['filename']}")
            copy_once(job['source'],raw)
            for number,source in enumerate(job.get('history',[]),1):
                copy_once(source,confined(root,f"outputs/history/codex-builtin/{task['id']:03d}/revision-{number}.png"))
            png,webp=output_file(root,task,'png'),output_file(root,task,'webp')
            if not png.exists() and not webp.exists():
                prepare_image(raw,png,webp,dimensions(task,styles),styles['background'],settings['webp_quality'])
            elif not task.get('raw') or digest(confined(root,task['raw']))!=digest(raw):
                raise ValueError('EXISTING_OUTPUT_REQUIRES_RECONCILIATION')
            qa=check_image(png,dimensions(task,styles),styles['background'])
            qa['webp']=check_image(webp,dimensions(task,styles),styles['background'])
            if task['type']=='A':
                qa['cover_title']={'expected_full_title':task['article_title'], 'expected_lines':job['title_lines'],
                                   'visual_check':'Codex checked visible title and two-line layout; final user approval pending'}
            else:
                qa['body_text']={'policy':'no_text','visual_check':job.get('visual_check','User review pending'),
                                 'reference_sha256':job.get('reference_sha256')}
            if not qa['passed_technical'] or not qa['webp']['passed_technical']:
                raise ValueError('BUILTIN_TECHNICAL_QA_FAILED')
            tracker.update(task,'REVIEW_REQUIRED',provider='codex_builtin',model='built-in tool; model not exposed',
                           raw=raw.relative_to(root).as_posix(),png=png.relative_to(root).as_posix(),
                           webp=webp.relative_to(root).as_posix(),qa=qa,usage={},token_cost_usd=None,
                           billing_mode='included-plan-usage',independent_api_calls=0,
                           title_lines=job.get('title_lines',[]),title_edit_prompt=job['title_edit_prompt'],
                           review_required=True,error=None)
        atomic_json(root/'outputs/reports/codex-builtin-batch.json',{
            'created_at':now(),'task_ids':ids,'execution':'codex_builtin','independent_api_calls':0,
            'usage_note':'Uses subscription allowance. Actual plan credits/token usage is not returned by the image tool.',
            'status':'REVIEW_REQUIRED','title_policy':manifest['title_policy']})
        return tracker.tasks


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest',type=Path)
    args=parser.parse_args()
    register_batch(Path(__file__).resolve().parents[1],read_json(args.manifest))
    print('Registered Codex built-in batch. No API request made; user review still required.')
