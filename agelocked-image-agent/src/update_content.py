"""Exact image-reference replacements; default output is an unapplied patch."""
import difflib
import re
from pathlib import Path
import yaml
from .common import confined, digest, exclusive_bytes


def replace_references(text, old, new, location=None):
    if not text.startswith('---'):
        raise ValueError('MARKDOWN_FRONTMATTER_MISSING')
    parts = text.split('---', 2)
    if len(parts) != 3:
        raise ValueError('MARKDOWN_FRONTMATTER_INVALID')
    before = yaml.safe_load(parts[1])
    front = parts[1]
    # Only the heroImage value, never prose/title/slug with coincidental text.
    if location in {None, '封面'}:
        front = re.sub(r'(?m)^(heroImage:\s*)([\"\']?)' + re.escape(old) + r'\2(\s*)$',
                       lambda m: m[1] + "'" + new + "'" + m[3], front)
    body = parts[2]
    # Exact targets: parentheses in Chinese filenames are escaped as literal characters.
    for prefix, suffix in ([] if location == '封面' else [(r'(!\[[^\]\n]*\]\()' , r'(\))'),
                           (r'(!\[[^\]\n]*\]\(<)', r'(>\))'),
                           (r'(<img\b[^>]*\bsrc=[\"\'])', r'([\"\'])')]):
        body = re.sub(prefix + re.escape(old) + suffix, lambda m: m[1] + new + m[2], body)
    # Markdown reference definitions whose labels are used by image references.
    labels = [] if location == '封面' else re.findall(r'!\[[^\]\n]*\]\[([^\]\n]+)\]', body)
    for label in labels:
        body = re.sub(r'(?m)^(\[' + re.escape(label) + r'\]:\s*)' + re.escape(old) + r'(\s*)$',
                      lambda m: m[1] + new + m[2], body)
    updated = '---' + front + '---' + body
    after = yaml.safe_load(front)
    if {k:v for k,v in before.items() if k != 'heroImage'} != {k:v for k,v in after.items() if k != 'heroImage'}:
        raise ValueError('NON_IMAGE_FRONTMATTER_CHANGED')
    return updated


def integration_plan(tasks, root, repo):
    root, repo = Path(root).resolve(), Path(repo).resolve()
    documents, assets, originals = {}, [], {}
    for task in tasks:
        if task['status'] != 'APPROVED':
            continue
        markdown = confined(repo, task['folder'] + '/index.md')
        if not markdown.is_file():
            raise ValueError('ARTICLE_NOT_INSTALLED_NEW_ARTICLE_REQUIRES_SEPARATE_REVIEW')
        text = documents.get(str(markdown), markdown.read_text(encoding='utf-8'))
        originals.setdefault(str(markdown), markdown.read_text(encoding='utf-8'))
        stem = Path(task['filename']).stem
        filename = stem + f"-agelocked-{task['id']:03d}.webp"
        target = confined(repo, task['folder'] + '/' + filename)
        if target.exists():
            raise ValueError('WEBSITE_OUTPUT_EXISTS_NO_OVERWRITE')
        updated = text
        for old in dict.fromkeys(['./' + Path(task['source_path']).name, './' + task['filename'], './' + stem + '.webp']):
            updated = replace_references(updated, old, './' + filename, task['position'])
        if updated == text:
            raise ValueError('EXACT_IMAGE_REFERENCE_NOT_FOUND')
        documents[str(markdown)] = updated
        assets.append({'source': task['webp'], 'destination': str(target), 'task_id': task['id']})
    patches = []
    for path, text in documents.items():
        relative = Path(path).relative_to(repo).as_posix()
        patches.extend(difflib.unified_diff(originals[path].splitlines(True), text.splitlines(True),
                                          fromfile='a/' + relative, tofile='b/' + relative))
    return {'patch': ''.join(patches), 'assets': assets, 'documents': documents,
            'originals': originals, 'hashes': {p:digest(p) for p in originals}}


def apply_plan(plan, root, repo):
    root, repo = Path(root).resolve(), Path(repo).resolve()
    # All preflight checks run before writing anything; originals are always backed up.
    for path, sha in plan['hashes'].items():
        if digest(path) != sha:
            raise ValueError('ARTICLE_CHANGED_SINCE_PREVIEW')
    for asset in plan['assets']:
        if Path(asset['destination']).exists() or not confined(root, asset['source']).is_file():
            raise ValueError('INTEGRATION_ASSET_PREFLIGHT_FAILED')
    from .common import now
    folder = Path(root) / 'outputs/backups' / now().replace(':','-')
    for path in plan['documents']:
        backup = confined(folder, Path(path).relative_to(repo))
        exclusive_bytes(backup, Path(path).read_bytes())
    for asset in plan['assets']:
        exclusive_bytes(asset['destination'], confined(root, asset['source']).read_bytes())
    # Bytes preserve existing CRLF if present; plan text was read with universal newlines.
    for path, text in plan['documents'].items():
        original_bytes = Path(path).read_bytes()
        if b'\r\n' in original_bytes:
            text = text.replace('\r\n','\n').replace('\n','\r\n')
        Path(path).write_bytes(text.encode('utf-8'))
