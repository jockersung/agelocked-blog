import hashlib
import json
import os
from pathlib import Path
from datetime import datetime, timezone


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def read_json(path, default=None):
    path = Path(path)
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default


def atomic_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(tmp, path)


def confined(root, relative):
    root = Path(root).resolve()
    relative = str(relative).replace('\\', '/')
    if any(part == '..' for part in relative.split('/')):
        raise ValueError('PATH_TRAVERSAL')
    path = (root / relative).resolve()
    if not path.is_relative_to(root):
        raise ValueError('PATH_OUTSIDE_ROOT')
    return path


def output_file(root, task, kind):
    extension = 'webp' if kind == 'webp' else 'png'
    # Each task owns its own directory, retaining Excel's Chinese basename.
    return confined(root, f"outputs/{kind}/{task['id']:03d}/{Path(task['filename']).stem}.{extension}")


def exclusive_bytes(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as stream:
        stream.write(data)


def load_settings(root):
    import yaml
    root = Path(root)
    # Only recognised .env keys are loaded, never serialized or logged.
    allowed = {'OPENAI_API_KEY', 'IMAGE_PROVIDER', 'IMAGE_MODEL', 'MAX_CONCURRENT_REQUESTS',
               'MAX_RETRIES', 'MAX_BUDGET_USD', 'DRY_RUN'}
    env = root / '.env'
    if env.exists():
        for line in env.read_text(encoding='utf-8-sig').splitlines():
            key, sep, value = line.strip().partition('=')
            if sep and key in allowed:
                os.environ.setdefault(key, value.strip().strip('\"\''))
    settings = yaml.safe_load((root / 'config/settings.yaml').read_text(encoding='utf-8'))
    for key, env_key, cast in [('provider', 'IMAGE_PROVIDER', str), ('model', 'IMAGE_MODEL', str),
                              ('max_concurrent_requests', 'MAX_CONCURRENT_REQUESTS', int),
                              ('max_retries', 'MAX_RETRIES', int), ('max_budget_usd', 'MAX_BUDGET_USD', float)]:
        if os.getenv(env_key):
            settings[key] = cast(os.environ[env_key])
    if os.getenv('DRY_RUN') is not None:
        settings['dry_run'] = os.environ['DRY_RUN'].lower() != 'false'
    if not 1 <= settings['max_concurrent_requests'] <= 2:
        raise ValueError('CONCURRENCY_MUST_BE_1_OR_2')
    if settings['max_retries'] < 0 or settings['max_retries'] > 3:
        raise ValueError('RETRIES_MUST_BE_0_TO_3')
    if settings['max_budget_usd'] <= 0 or settings['request_reserve_usd'] <= 0:
        raise ValueError('INVALID_BUDGET')
    if any(settings[key] != settings['pricing'][price_key] for key, price_key in
           [('model','model'),('quality','quality'),('api_size','size')]):
        raise ValueError('MODEL_QUALITY_OR_SIZE_NEEDS_NEW_PRICE_REVIEW')
    return settings
