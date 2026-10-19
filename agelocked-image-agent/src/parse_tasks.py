from pathlib import Path
import re
import openpyxl
import yaml
from .common import confined


def article_titles(repo, excel):
    """Read actual frontmatter, including supplemental articles not installed on site."""
    result = {}
    sources = list((Path(repo)/'src/content/blog').rglob('index.md'))
    sources.extend((Path(excel).resolve().parents[2]/'inputs/unpacked').rglob('*.md'))
    for source in sources:
        text=source.read_text(encoding='utf-8-sig')
        if not text.startswith('---'):
            continue
        parts=text.split('---',2)
        if len(parts)!=3:
            continue
        metadata=yaml.safe_load(parts[1]) or {}
        slug,title=metadata.get('slug'),metadata.get('title')
        if slug and title:
            if slug in result and result[slug]!=title:
                raise ValueError('CONFLICTING_ARTICLE_TITLES')
            result[slug]=title
    return result


def parse_tasks(excel, repo, expected=221):
    titles=article_titles(repo,excel)
    book = openpyxl.load_workbook(excel, read_only=True, data_only=False)
    try:
        sheet = book['產圖清單']
        rows = list(sheet.iter_rows())
        headers = [str(c.value or '') for c in rows[0]]
        if len(headers) != 13 or headers[:3] != ['序號', '批次', '文章 slug']:
            raise ValueError('UNEXPECTED_EXCEL_SCHEMA')
        tasks = []
        for row in rows[1:]:
            if not row[0].value:
                continue
            if any(c.data_type == 'f' for c in row):
                raise ValueError('FORMULAS_NOT_ALLOWED_IN_TASK_INPUT')
            values = [str(c.value or '').strip() for c in row]
            ident, batch, slug, category, position, raw, kind, action, attachments, prompt, overlay, filename, done = values
            path = re.sub(r'^（新文章）', '', raw).replace('\\', '/')
            if not path.startswith('src/content/blog/'):
                raise ValueError('TASK_PATH_OUTSIDE_BLOG')
            if not filename or Path(filename).name != filename or '/' in filename or '\\' in filename:
                raise ValueError('INVALID_OUTPUT_FILENAME')
            confined(repo, path)
            source_path = path + filename if path.endswith('/') else path
            folder = path.rstrip('/') if path.endswith('/') else str(Path(path).parent).replace('\\', '/')
            task = dict(id=int(ident), batch=str(batch), slug=slug, category=category,
                        position=position, source_path=source_path, folder=folder, type=kind,
                        action=action, attachments=attachments, prompt=prompt, overlay_text=overlay,
                        filename=filename, excel_row=row[0].row, excel_done=done, status='PENDING')
            if slug in titles:
                task['article_title']=titles[slug]
            if kind not in 'ABCD' or len(kind) != 1 or not slug or not prompt:
                raise ValueError('INVALID_TASK')
            tasks.append(task)
    finally:
        book.close()
    if len(tasks) != expected or len({t['id'] for t in tasks}) != expected:
        raise ValueError(f'EXPECTED_{expected}_UNIQUE_TASKS_GOT_{len(tasks)}')
    # Excel explicitly marks four reuse jobs. Resolve to the unique newly generated cover,
    # not another old file sharing the same basename.
    for task in tasks:
        if '沿用同一張' in task['action']:
            candidates = [t for t in tasks if t['filename'] == task['filename']
                          and t['type'] == 'A' and '新產' in t['action']]
            if len(candidates) != 1:
                raise ValueError('AMBIGUOUS_REUSE_DEPENDENCY')
            task['reuse_of'] = candidates[0]['id']
    targets = [(t['folder'] + '/' + Path(t['filename']).stem + '.webp').casefold() for t in tasks]
    for task, target in zip(tasks, targets):
        shared = [other['id'] for other, other_target in zip(tasks, targets) if other_target == target and other['id'] != task['id']]
        if shared:
            # One existing image can serve both hero and body. Preserve both Excel tasks;
            # staged outputs are isolated by ID and integration updates each location separately.
            task['shared_source_task_ids'] = shared
    return tasks
