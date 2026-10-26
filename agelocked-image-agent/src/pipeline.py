import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import yaml
from .common import atomic_json, read_json, load_settings, confined, digest, output_file, now
from .parse_tasks import parse_tasks
from .validate_assets import extract_archive, image_inventory, validate_task, import_existing
from .progress_tracker import Tracker, Budget, process_lock
from .image_provider import create_provider
from .generate_images import generate_task
from .image_processing import prepare_image, dimensions
from .quality_check import check_image
from .render_charts import render_chart
from .reports import batch_reports, package_completed, cost_estimate
from .update_content import integration_plan, apply_plan

FOLDERS = ['inputs/excel','inputs/manuals','inputs/anchors','inputs/source_images','inputs/product_photos',
           'inputs/existing_images','inputs/chart_data','inputs/fonts','inputs/unpacked','tasks',
           'outputs/raw','outputs/png','outputs/webp','outputs/previews','outputs/staging',
           'outputs/batches','outputs/reports','outputs/backups']


def initialize(root):
    for folder in FOLDERS:
        (root / folder).mkdir(parents=True, exist_ok=True)
    for name, destination in [('AGELOCKED-ChatGPT產圖清單.xlsx','inputs/excel'),
                              ('AGELOCKED-ChatGPT產圖作業手冊.md','inputs/manuals')]:
        source, target = root / name, root / destination / name
        if not target.exists() and source.exists():
            with target.open('xb') as out, source.open('rb') as inp:
                shutil.copyfileobj(inp, out)


def selected_tasks(tasks, args):
    selected = [t for t in tasks if (args.batch is None or t['batch'] == args.batch)
                and (not args.slug or t['slug'] == args.slug)]
    if args.task_ids:
        ids = {int(v) for v in args.task_ids.split(',')}
        if ids - {t['id'] for t in tasks}:
            raise ValueError('UNKNOWN_TASK_ID')
        selected = [t for t in selected if t['id'] in ids]
    return selected


def production_fingerprint(task, settings):
    references = [{'path':p, 'sha256':digest(p)} for p in task.get('references',[]) ]
    data = {'id':task['id'], 'prompt':task['prompt'], 'action':task['action'], 'refs':references,
            'article_title':task.get('article_title'),
            'style_profile':task.get('style_profile'), 'visual_kind':task.get('visual_kind'),
            'style_profiles_sha256':settings.get('style_profiles_sha256'),
            'model':settings['model'],'quality':settings['quality'],'size':settings['api_size'],
            'budget':settings['max_budget_usd'],'pricing':settings['pricing'],
            'reserve':settings['request_reserve_usd'],
            'templates_sha256':settings.get('templates_sha256'), 'styles_sha256':settings.get('styles_sha256')}
    return hashlib.sha256(json.dumps(data,ensure_ascii=False,sort_keys=True).encode()).hexdigest()


def paid_gate(root, settings, selected):
    if not settings['existing_drafts_resolved']:
        raise ValueError('EXISTING_DRAFTS_UNRESOLVED_NO_PAID_REGENERATION')
    if settings['dry_run']:
        raise ValueError('DRY_RUN_IS_TRUE_SET_FALSE_ONLY_AFTER_COST_APPROVAL')
    approval = read_json(root / 'config/approval.json', {})
    if not approval.get('approved_by') or not approval.get('recorded_at'):
        raise ValueError('COST_APPROVAL_REQUIRED')
    if settings['max_budget_usd'] > approval.get('budget_usd',0):
        raise ValueError('BUDGET_EXCEEDS_APPROVAL')
    for task in selected:
        if approval.get('fingerprints',{}).get(str(task['id'])) != production_fingerprint(task,settings):
            raise ValueError('TASK_MODEL_OR_ASSETS_NOT_COST_APPROVED')
    history = read_json(root / 'config/approval.history.json', {})
    if not history.get('trial_passed') and len(selected) > 3:
        raise ValueError('FIRST_TRIAL_LIMIT_IS_THREE')


def archive_force(task, root, tracker):
    folder = root / 'outputs/history' / f"{task['id']:03d}" / now().replace(':','-')
    for key in ['raw','png','webp']:
        if task.get(key):
            old = confined(root,task[key])
            if old.exists():
                folder.mkdir(parents=True,exist_ok=True)
                shutil.move(str(old),str(folder/(key+'-'+old.name)))
    for key in ['raw','png','webp','qa','usage','request_id','token_cost_usd','error','approved_by','approved_sha256']:
        task.pop(key,None)
    tracker.update(task,task.get('asset_status','PENDING'))


def approve_tasks(selected, root, styles, tracker, reviewer):
    if not reviewer:
        raise ValueError('REVIEWER_NAME_REQUIRED')
    for task in selected:
        if task['status'] not in {'GENERATED','REVIEW_REQUIRED'} or not task.get('png'):
            raise ValueError('NO_FINISHED_DRAFT_TO_APPROVE')
        png, webp = confined(root,task['png']), confined(root,task['webp'])
        qa = check_image(png,dimensions(task,styles))
        qa_webp = check_image(webp,dimensions(task,styles))
        if not qa['passed_technical'] or not qa_webp['passed_technical']:
            raise ValueError('TECHNICAL_QA_FAILED')
        tracker.update(task,'APPROVED',approved_by=reviewer,approved_at=now(),
                       approved_sha256={'png':digest(png),'webp':digest(webp)},qa=qa,
                       human_attestations=['no_unexpected_text','correct_science','style_and_crop','correct_packaging_if_applicable'])


def local_jobs(selected, root, repo, settings, styles, tracker):
    for task in selected:
        if task.get('raw') and task['status'] in {'GENERATED','REVIEW_REQUIRED'} and not task.get('png'):
            # Recover post-processing from a persisted paid response without another API call.
            png,webp=output_file(root,task,'png'),output_file(root,task,'webp')
            source=confined(root,task['raw'])
            if task['type']=='D':
                from .image_processing import composite_product
                composite=source.with_name('product-composite.png')
                if not composite.exists():
                    composite_product(source,task['product_photo'],composite)
                source=composite
            if png.exists() or webp.exists():
                import uuid
                temp=root/'outputs/staging'/uuid.uuid4().hex
                first,second=prepare_image(source,temp/'recovery.png',temp/'recovery.webp',dimensions(task,styles),quality=settings['webp_quality'])
                for candidate,target in [(first,png),(second,webp)]:
                    if target.exists():
                        if not check_image(target,dimensions(task,styles))['passed_technical']:
                            raise ValueError('PARTIAL_OUTPUT_REQUIRES_REVIEW')
                    else:
                        target.parent.mkdir(parents=True,exist_ok=True)
                        shutil.copyfile(candidate,target)
            else:
                prepare_image(source,png,webp,dimensions(task,styles),quality=settings['webp_quality'])
            tracker.update(task,'REVIEW_REQUIRED',png=png.relative_to(root).as_posix(),webp=webp.relative_to(root).as_posix(),
                           qa=check_image(png,dimensions(task,styles)))
        elif task.get('existing_draft') and not task.get('png'):
            png, webp = output_file(root,task,'png'),output_file(root,task,'webp')
            prepare_image(confined(root,task['existing_draft']),png,webp,dimensions(task,styles),quality=settings['webp_quality'])
            tracker.update(task,'REVIEW_REQUIRED',png=png.relative_to(root).as_posix(),webp=webp.relative_to(root).as_posix(),
                           qa=check_image(png,dimensions(task,styles)))
        elif task['status'] == 'READY' and (task.get('reuse_of') or task['type']=='C'):
            raw = output_file(root,task,'raw')
            if task.get('reuse_of'):
                parent = next(t for t in tracker.tasks if t['id']==task['reuse_of'])
                verify_approval(parent,root)
                source = confined(root,parent['png'])
            else:
                font = root / 'inputs/fonts/NotoSansTC-Regular.ttf'
                render_chart(task['chart_data'],font,raw,dimensions(task,styles))
                source = raw
            png, webp = output_file(root,task,'png'), output_file(root,task,'webp')
            prepare_image(source,png,webp,dimensions(task,styles),quality=settings['webp_quality'])
            tracker.update(task,'REVIEW_REQUIRED',png=png.relative_to(root).as_posix(),webp=webp.relative_to(root).as_posix(),
                           qa=check_image(png,dimensions(task,styles)),model='local-render-or-reuse')


def verify_approval(task, root):
    if task['status'] not in {'APPROVED','COMPLETED'}:
        raise ValueError('IMAGE_NOT_APPROVED')
    for key in ['png','webp']:
        if digest(confined(root,task[key])) != task.get('approved_sha256',{}).get(key):
            raise ValueError('APPROVED_IMAGE_CHANGED')


def run(root, args):
    root = Path(root).resolve()
    initialize(root)
    settings = load_settings(root)
    repo = (root / settings['repo_root']).resolve()
    styles = yaml.safe_load((root/'config/styles.yaml').read_text(encoding='utf-8'))
    templates = yaml.safe_load((root/'config/prompt_templates.yaml').read_text(encoding='utf-8'))
    settings['templates_sha256']=digest(root/'config/prompt_templates.yaml')
    settings['styles_sha256']=digest(root/'config/styles.yaml')
    profile_file=root/'config/style_profiles.yaml'
    settings['style_profiles_sha256']=digest(profile_file) if profile_file.exists() else None
    archive = root / settings['archive']
    if archive.is_file():
        extract_archive(archive,root/'inputs/unpacked')
    parsed = parse_tasks(confined(root,settings['excel']),repo,settings['expected_tasks'])
    with process_lock(root):
        tracker = Tracker(root,parsed)
        for task in tracker.tasks:
            validate_task(task,root,repo,styles,settings,tracker.tasks)
        existing = import_existing(tracker.tasks,root)
        tracker.save()
        selected = selected_tasks(tracker.tasks,args)
        if args.limit is not None and args.limit <= 0:
            raise ValueError('LIMIT_MUST_BE_POSITIVE')
        if args.inspect or args.dry_run:
            inventory, duplicates = image_inventory(repo)
            atomic_json(root/'outputs/reports/image_inventory.json',inventory)
            atomic_json(root/'outputs/reports/duplicate_images.json',duplicates)
            atomic_json(root/'outputs/reports/existing_images.json',existing)
            # No provider is even instantiated on either offline path.
        elif args.approve:
            approve_tasks(selected,root,styles,tracker,args.reviewed_by)
        elif args.trial_passed:
            approved = [t for t in tracker.tasks if t['status'] in {'APPROVED','COMPLETED'} and t.get('model')==settings['model']]
            if len(approved)<3 or not args.reviewed_by:
                raise ValueError('THREE_APPROVED_TRIAL_IMAGES_AND_REVIEWER_REQUIRED')
            atomic_json(root/'config/approval.history.json',{'trial_passed':True,'reviewed_by':args.reviewed_by,'date':now()})
        elif args.approve_cost:
            if not args.reviewed_by:
                raise ValueError('COST_APPROVER_REQUIRED')
            ready = [t for t in selected if t['status']=='READY' and t['type']!='C' and not t.get('reuse_of')]
            if args.limit:
                ready = ready[:args.limit]
            if not ready:
                raise ValueError('NO_READY_TASKS_TO_APPROVE')
            if not read_json(root/'config/approval.history.json',{}).get('trial_passed') and len(ready)>3:
                raise ValueError('FIRST_TRIAL_LIMIT_IS_THREE')
            atomic_json(root/'config/approval.json',{'approved_by':args.reviewed_by,'recorded_at':now(),
                        'budget_usd':settings['max_budget_usd'],'estimate':cost_estimate(ready,settings),
                        'fingerprints':{str(t['id']):production_fingerprint(t,settings) for t in ready}})
        elif args.integrate_preview or args.integrate:
            selected = [t for t in selected if t['status']=='APPROVED']
            for task in selected:
                verify_approval(task,root)
            plan = integration_plan(selected,root,repo)
            (root/'outputs/reports/content-preview.patch').write_text(plan['patch'],encoding='utf-8')
            atomic_json(root/'outputs/reports/content-plan.json', {k:v for k,v in plan.items() if k not in {'documents','originals'}})
            if args.integrate:
                if not args.confirm_site_changes:
                    raise ValueError('EXPLICIT_SITE_CHANGE_CONFIRMATION_REQUIRED')
                apply_plan(plan,root,repo)
                for task in selected:
                    tracker.update(task,'COMPLETED',integrated_at=now())
        elif args.package:
            for task in selected:
                if task['status']=='COMPLETED':
                    verify_approval(task,root)
            package_completed(root,selected,root/'outputs/batches/completed.zip')
        elif not args.report:
            # --force keeps historical files, cannot bypass budget, approval or asset gates.
            if args.force:
                for task in selected:
                    if task['status'] in {'APPROVED','COMPLETED','GENERATED','REVIEW_REQUIRED','FAILED'}:
                        archive_force(task,root,tracker)
            if settings['dry_run']:
                raise ValueError('DRY_RUN_IS_TRUE_USE_DRY_RUN_OR_APPROVE_COST_FIRST')
            local_jobs(selected,root,repo,settings,styles,tracker)
            ready = [t for t in selected if t['status']=='READY' and t['type']!='C' and not t.get('reuse_of')]
            if args.limit:
                ready=ready[:args.limit]
            if ready:
                paid_gate(root,settings,ready)
                budget = Budget(root,settings['max_budget_usd'],settings['request_reserve_usd'])
                provider = create_provider(settings)
                # Dispatch at most two at once; persist each completion immediately.
                # A failure stops further windows, so ambiguous requests are not blindly reissued.
                for start in range(0,len(ready),settings['max_concurrent_requests']):
                    with ThreadPoolExecutor(max_workers=settings['max_concurrent_requests']) as executor:
                        futures=[executor.submit(generate_task,t,root,settings,styles,templates,provider,tracker,budget)
                                 for t in ready[start:start+settings['max_concurrent_requests']]]
                        for future in futures:
                            future.result()
                    if any(t['status']=='FAILED' for t in ready[start:start+settings['max_concurrent_requests']]):
                        break
        summary=batch_reports(root,tracker.tasks,settings)
        summary['existing_images']=existing
        summary['generation_holds']=[] if settings['existing_drafts_resolved'] else ['EXISTING_IMAGE_NOT_FOUND_OR_UNRESOLVED']
        summary['immediately_generatable']=sum(t['status']=='READY' and t['type']!='C' and not t.get('reuse_of') for t in tracker.tasks)
        atomic_json(root/'outputs/reports/summary.json',summary)
        print(json.dumps(summary,ensure_ascii=False,indent=2))
        return summary


def main(root=None):
    parser=argparse.ArgumentParser(description='AGELOCKED image production; offline by default')
    mode=parser.add_mutually_exclusive_group()
    for flag in ['inspect','dry-run','resume','report','package','approve','approve-cost','trial-passed','integrate-preview','integrate']:
        mode.add_argument('--'+flag,action='store_true')
    parser.add_argument('--batch')
    parser.add_argument('--slug')
    parser.add_argument('--task-ids',help='Comma-separated exact Excel IDs')
    parser.add_argument('--limit',type=int)
    parser.add_argument('--force',action='store_true')
    parser.add_argument('--reviewed-by')
    parser.add_argument('--confirm-site-changes',action='store_true')
    args=parser.parse_args()
    try:
        return run(root or Path(__file__).resolve().parents[1],args)
    except Exception as error:
        # Controlled codes only. Third-party error messages may include request bodies.
        known = isinstance(error,ValueError) and str(error).replace('_','').replace(' ','').isalnum()
        print('ERROR: '+(str(error) if known else type(error).__name__),file=sys.stderr)
        return 2
