import csv
import html
import json
import os
from pathlib import Path
from urllib.parse import quote
from zipfile import ZipFile, ZIP_DEFLATED
from collections import Counter
from .common import atomic_json, confined, digest, read_json


def write_csv(path, rows, fields):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fields, extrasaction='ignore')
        writer.writeheader()
        for row in rows:
            cleaned = {}
            for key in fields:
                value = row.get(key, '')
                if isinstance(value, (list, dict)):
                    value = json.dumps(value, ensure_ascii=False)
                # Prevent formula evaluation when opening CSV in Excel.
                if isinstance(value, str) and value.startswith(('=', '+', '-', '@')):
                    value = "'" + value
                cleaned[key] = value
            writer.writerow(cleaned)


def needs_api_estimate(task):
    if task['type']=='C' or task.get('reuse_of'):
        return False
    if task['status'] in {'GENERATED','REVIEW_REQUIRED','APPROVED','COMPLETED'} and any(
            task.get(k) for k in ['png','raw','existing_draft']):
        return False
    return True


def cost_estimate(tasks, settings):
    pricing = settings['pricing']
    billable = [t for t in tasks if needs_api_estimate(t)]
    low = pricing['output_estimate_usd'] + pricing['input_allowance_low_usd']
    high = pricing['output_estimate_usd'] + pricing['input_allowance_high_usd']
    n = len(billable)
    return {'model': settings['model'], 'quality': settings['quality'], 'size': settings['api_size'],
            'estimate_scope':'Optional independent API route; not charges for Codex built-in images',
            'preferred_execution':settings.get('preferred_execution','openai_api'),
            'potential_api_jobs': n, 'per_image_output_only_usd': pricing['output_estimate_usd'],
            'planning_per_image_usd': [round(low,4), round(high,4)],
            'planning_total_usd': [round(n*low,4), round(n*high,4)],
            'request_reserve_usd': settings['request_reserve_usd'],
            'all_221_if_each_generated_output_only_usd': round(221 * pricing['output_estimate_usd'],4),
            'all_221_if_each_generated_planning_usd': [round(221*low,4),round(221*high,4)],
            'note': 'Planning range includes assumed input allowances, not an invoice or guaranteed upper bound. Charts and reuse do not use the image API. Retry/regeneration costs are extra.',
            'source': pricing['source'], 'verified_date': pricing['verified_date']}


def package_completed(root, tasks, destination):
    root, destination = Path(root).resolve(), Path(destination).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    completed = [t for t in tasks if t['status'] == 'COMPLETED']
    members = []
    for task in completed:
        for key in ['png', 'webp']:
            path = confined(root, task[key])
            expected = confined(root, 'outputs/' + key)
            if not path.is_relative_to(expected) or not path.is_file():
                raise ValueError('PACKAGE_FILE_NOT_VALIDATED')
            members.append((path, path.relative_to(root).as_posix()))
    with ZipFile(destination, 'w', ZIP_DEFLATED) as archive:
        archive.writestr('manifest.json', json.dumps({'completed': len(completed), 'files': [
            {'path': name, 'sha256': digest(path)} for path, name in members]}, ensure_ascii=False, indent=2))
        for path, name in members:
            archive.write(path, name)
    with ZipFile(destination) as archive:
        if archive.testzip() is not None or len(archive.namelist()) != len(members) + 1:
            raise ValueError('PACKAGE_VERIFICATION_FAILED')
    return destination


def batch_reports(root, tasks, settings):
    root = Path(root)
    summary = {'total': len(tasks), 'types': dict(Counter(t['type'] for t in tasks)),
               'batches': dict(Counter(t['batch'] for t in tasks)),
               'statuses': dict(Counter(t['status'] for t in tasks)),
               'asset_reasons': dict(Counter(r for t in tasks for r in t.get('asset_reasons', []))),
               'cost': cost_estimate(tasks, settings)}
    report_dir = root / 'outputs/reports'
    atomic_json(report_dir / 'summary.json', summary)
    fields = ['id', 'batch', 'slug', 'type', 'position', 'source_path', 'filename', 'status', 'asset_reasons',
              'source_exists', 'reuse_of', 'png', 'webp', 'qa', 'model', 'usage', 'token_cost_usd', 'error']
    write_csv(report_dir / 'all_tasks.csv', tasks, fields)
    write_csv(report_dir / 'missing_assets.csv', [t for t in tasks if t.get('asset_reasons')], fields)
    for batch in dict.fromkeys(t['batch'] for t in tasks):
        selected = [t for t in tasks if t['batch'] == batch]
        name = f'batch_{int(batch):02d}' if batch.isdigit() else 'batch_reuse'
        folder = root / 'outputs/batches'
        folder.mkdir(parents=True, exist_ok=True)
        write_csv(folder / (name + '_manifest.csv'), selected, fields)
        write_csv(folder / (name + '_blocked.csv'), [t for t in selected if t.get('asset_reasons')], fields)
        estimate = cost_estimate(selected, settings)
        write_csv(folder / (name + '_cost_report.csv'), [{
            'id': t['id'], 'model': t.get('model',settings['model']), 'usage': t.get('usage',{}),
            'token_cost_usd': t.get('token_cost_usd'), 'estimate_output_usd':
            0 if not needs_api_estimate(t) or t.get('provider')=='codex_builtin' else settings['pricing']['output_estimate_usd'],
            'invoice_cost_usd': 'NOT_AVAILABLE', 'batch_planning_usd': estimate['planning_total_usd']
        } for t in selected], ['id','model','usage','token_cost_usd','estimate_output_usd','invoice_cost_usd','batch_planning_usd'])
        cards = []
        for t in selected:
            preview = '<div class="empty">尚無新圖</div>'
            preview_path=t.get('png') or t.get('existing_draft')
            if preview_path:
                path = confined(root, preview_path)
                if path.exists():
                    url = quote(os.path.relpath(path, folder).replace('\\','/'), safe='/')
                    preview = f'<img loading="lazy" src="{url}" alt="任務 {t["id"]} 新圖">'
            values = {k:html.escape(str(t.get(k,''))) for k in ['id','slug','filename','type','status','model','usage','token_cost_usd']}
            cards.append(f'<article>{preview}<h2>#{values["id"]} {values["slug"]}</h2><p>{values["filename"]}</p>'
                         f'<p>{values["type"]} · {values["status"]}</p><p>{values["model"]}</p>'
                         f'<p>Usage: {values["usage"]} · Token cost: {values["token_cost_usd"]}</p>'
                         '<pre>' + html.escape(json.dumps({'qa':t.get('qa'), 'missing':t.get('asset_reasons'), 'error':t.get('error')},ensure_ascii=False,indent=2)) + '</pre></article>')
        page = '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>AGELOCKED 審核 ' + name + '</title><style>body{background:#FAF7F2;color:#1F2A30;font:16px system-ui;margin:28px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px}article{background:white;padding:16px;border:1px solid #8FB9A8;border-radius:12px;overflow-wrap:anywhere}img,.empty{width:100%;aspect-ratio:16/9;object-fit:contain;background:#EEF4F6}h2{font-size:18px}pre{white-space:pre-wrap;font-size:13px}.empty{display:grid;place-items:center}</style><h1>AGELOCKED 圖片審核 · ' + name + '</h1><p>生成成功不代表人工審核通過。缺圖、OCR、科學正確性與產品包裝檢查均須如實確認。</p><main>' + ''.join(cards) + '</main></html>'
        (folder / (name + '_review.html')).write_text(page,encoding='utf-8')
        package_completed(root, selected, folder / (name + '_completed.zip'))
    return summary
