from pathlib import Path
from zipfile import ZipFile
import shutil
import stat
from collections import defaultdict
from PIL import Image
from .common import confined, digest, read_json, exclusive_bytes

IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp'}


def extract_archive(archive, destination):
    """Bounded extraction, rejecting traversal, symlinks, secrets and overwrites."""
    destination = Path(destination)
    with ZipFile(archive) as z:
        if sum(e.file_size for e in z.infolist()) > 100 * 1024 * 1024 or len(z.infolist()) > 2000:
            raise ValueError('ARCHIVE_TOO_LARGE')
        entries = []
        for entry in z.infolist():
            path = confined(destination, entry.filename)
            if stat.S_ISLNK(entry.external_attr >> 16) or path.name.startswith('.env'):
                raise ValueError('UNSAFE_ARCHIVE_ENTRY')
            entries.append((entry, path))
        for entry, path in entries:
            if entry.is_dir():
                path.mkdir(parents=True, exist_ok=True)
            elif not path.exists():
                exclusive_bytes(path, z.read(entry))
            elif digest(path) != __import__('hashlib').sha256(z.read(entry)).hexdigest():
                raise ValueError('EXTRACT_WOULD_OVERWRITE')


def image_inventory(repo):
    rows, hashes = [], defaultdict(list)
    for base in ['src', 'public']:
        for path in sorted((Path(repo) / base).rglob('*')):
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
                item = {'path': path.relative_to(repo).as_posix(), 'bytes': path.stat().st_size,
                        'sha256': digest(path)}
                try:
                    with Image.open(path) as im:
                        im.verify()
                    with Image.open(path) as im:
                        item.update(width=im.width, height=im.height, format=im.format)
                except Exception:
                    item['error'] = 'UNREADABLE_IMAGE'
                rows.append(item)
                hashes[item['sha256']].append(item['path'])
    return rows, [paths for paths in hashes.values() if len(paths) > 1]


def _checked_image(root, relative):
    if not relative:
        return None
    path = confined(root, relative)
    if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
        return None
    try:
        with Image.open(path) as image:
            image.verify()
        return str(path)
    except Exception:
        return None


def validate_task(task, root, repo, styles, settings, tasks):
    reasons, refs = [], []
    source = confined(repo, task['source_path'])
    # An original image in the website is never treated as a generated replacement draft.
    task['source_exists'] = source.is_file()
    task['source_sha256'] = digest(source) if source.is_file() else None
    task['article_exists'] = confined(repo, task['folder'] + '/index.md').is_file()
    if task.get('reuse_of'):
        parent = next(t for t in tasks if t['id'] == task['reuse_of'])
        if parent['status'] not in {'APPROVED', 'COMPLETED'}:
            reasons.append('REUSE_SOURCE_NOT_APPROVED')
    elif task['type'] == 'C':
        data_path = confined(root, f"inputs/chart_data/{task['id']:03d}.json")
        data = read_json(data_path, {})
        if not data:
            reasons.append('SCIENTIFIC_DATA_NOT_CONFIRMED')
        elif not data.get('confirmed_by') or not data.get('source'):
            reasons.append('SCIENTIFIC_DATA_NOT_CONFIRMED')
        else:
            from .render_charts import validate_data
            try:
                validate_data(data)
            except ValueError:
                reasons.append('SCIENTIFIC_DATA_SCHEMA_INVALID')
        task['chart_data'] = str(data_path)
        if not (Path(root) / 'inputs/fonts/NotoSansTC-Regular.ttf').is_file():
            reasons.append('NOTO_SANS_TC_FONT_MISSING')
    elif task['type'] == 'D':
        registry = read_json(Path(root) / 'inputs/product_photos/manifest.json', {})
        product = registry.get(str(task['id']), {})
        photo = _checked_image(root, product.get('file'))
        if not photo or not product.get('official_source') or not product.get('verified_by'):
            reasons.append('OFFICIAL_PRODUCT_PHOTO_MISSING')
        else:
            with Image.open(photo) as image:
                if image.mode != 'RGBA' or image.getextrema()[3][0] == 255:
                    reasons.append('OFFICIAL_PRODUCT_CUTOUT_REQUIRED')
            task['product_photo'] = photo
        refs = [_checked_image(root, p) for p in styles['product_anchors']]
        if not refs or not all(refs):
            reasons.append('PRODUCT_STYLE_ANCHORS_MISSING')
    else:
        if '照原構圖' in task['action']:
            original = _checked_image(repo, task['source_path'])
            if not original:
                # Optional explicit replacement mapping, never fuzzy filename matching.
                mapping = read_json(Path(root) / 'inputs/source_images/manifest.json', {})
                original = _checked_image(root, mapping.get(str(task['id'])))
            if not original:
                reasons.append('ORIGINAL_IMAGE_MISSING')
            else:
                refs.append(original)
        anchors = [_checked_image(root, p) for p in styles['general_anchors']]
        if not anchors or not all(anchors):
            reasons.append('STYLE_ANCHORS_MISSING')
        refs.extend(p for p in anchors if p)
    # Reviewed first image from same article becomes an additional visual reference.
    for other in tasks:
        if other['id'] != task['id'] and other['slug'] == task['slug'] and other['status'] in {'APPROVED', 'COMPLETED'} and other.get('png'):
            refs.append(str(confined(root, other['png'])))
            break
    task['references'] = list(dict.fromkeys(p for p in refs if p))
    task['asset_reasons'] = reasons
    task['asset_status'] = ('REVIEW_REQUIRED' if task['type'] == 'C' else 'BLOCKED') if reasons else 'READY'
    if task['status'] in {'PENDING', 'READY', 'BLOCKED'} or (task['status'] == 'REVIEW_REQUIRED' and not task.get('png')):
        task['status'] = task['asset_status']
    return task


def import_existing(tasks, root):
    folder = Path(root) / 'inputs/existing_images'
    manifest = read_json(folder / 'manifest.json', {})
    mapped, registered, manifest_files = [], [], set()
    for task in tasks:
        entry = manifest.get(str(task['id']), {})
        if not entry:
            continue
        path = _checked_image(root, entry.get('file'))
        if not path or not entry.get('mapped_by'):
            continue
        manifest_files.add(path)
        registered.append(task['id'])
        if task.get('existing_draft')==entry['file'] and task.get('existing_sha256')==digest(path):
            continue
        if task.get('png') or task['status'] in {'APPROVED', 'COMPLETED'}:
            continue
        task.update(status='GENERATED', existing_draft=entry['file'], existing_sha256=digest(path),
                    model='existing-chatgpt-draft', provider='user_supplied_chatgpt_draft',
                    independent_api_calls=0, review_required=True)
        mapped.append(task['id'])
    files = [p for p in folder.rglob('*') if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS]
    found=len({str(p.resolve()) for p in files}|manifest_files)
    return {'files_found': found, 'mapped_task_ids': mapped, 'registered_task_ids':registered,
            'notice': 'EXISTING_IMAGE_NOT_FOUND' if not found else 'EXISTING_IMAGES_REQUIRE_MAPPING_AND_REVIEW'}
