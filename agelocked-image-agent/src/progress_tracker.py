import os
import threading
from contextlib import contextmanager
from pathlib import Path
from .common import atomic_json, read_json, now

STATUSES = {'PENDING', 'READY', 'GENERATING', 'GENERATED', 'REVIEW_REQUIRED', 'APPROVED', 'BLOCKED', 'FAILED', 'COMPLETED'}


@contextmanager
def process_lock(root):
    """An OS-owned lock releases on crash. A leftover lock file cannot deadlock resume."""
    path = Path(root) / 'tasks/.process.lock'
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a+b') as stream:
        stream.seek(0)
        if not stream.read(1):
            stream.write(b'0')
            stream.flush()
        stream.seek(0)
        if os.name == 'nt':
            import msvcrt
            try:
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError:
                raise ValueError('ANOTHER_PIPELINE_IS_RUNNING') from None
        else:
            import fcntl
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            stream.seek(0)
            if os.name == 'nt':
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream, fcntl.LOCK_UN)


class Tracker:
    def __init__(self, root, parsed):
        self.root, self.lock = Path(root), threading.RLock()
        old = {t['id']: t for t in read_json(self.root / 'tasks/tasks.json', [])}
        self.tasks = []
        for task in parsed:
            previous = old.get(task['id'])
            if previous:
                if task.get('article_title'):
                    if previous.get('article_title') and previous['article_title']!=task['article_title']:
                        raise ValueError('ARTICLE_TITLE_CHANGED_REQUIRES_REVIEW')
                    previous['article_title']=task['article_title']
                for key in ['slug', 'source_path', 'type', 'action', 'prompt', 'filename']:
                    if previous[key] != task[key]:
                        raise ValueError('TASK_INPUT_CHANGED_REQUIRES_RECONCILIATION')
                task = previous
                if task['status'] == 'GENERATING':
                    task.update(status='REVIEW_REQUIRED', error='INTERRUPTED_REQUEST_OUTCOME_UNKNOWN')
            self.tasks.append(task)

    def save(self):
        with self.lock:
            atomic_json(self.root / 'tasks/tasks.json', self.tasks)
            for filename, statuses in [('completed', {'COMPLETED'}), ('blocked', {'BLOCKED'}),
                                       ('failed', {'FAILED'}), ('review_queue', {'GENERATED', 'REVIEW_REQUIRED', 'APPROVED'})]:
                atomic_json(self.root / f'tasks/{filename}.json', [t for t in self.tasks if t['status'] in statuses])

    def update(self, task, status, **fields):
        if status not in STATUSES:
            raise ValueError('UNKNOWN_STATUS')
        with self.lock:
            task.update(status=status, updated_at=now(), **fields)
            self.save()


class Budget:
    def __init__(self, root, maximum, reserve):
        self.path = Path(root) / 'tasks/cost_ledger.json'
        self.maximum, self.reserve_amount = float(maximum), float(reserve)
        self.entries = read_json(self.path, [])
        self.lock = threading.RLock()
        for entry in self.entries:
            if entry['state'] == 'RESERVED':
                entry['state'] = 'OUTCOME_UNKNOWN'
        if self.entries:
            atomic_json(self.path,self.entries)

    def exposure(self):
        return sum(e['charged_or_reserved_usd'] for e in self.entries)

    def reserve(self, ident, model):
        with self.lock:
            if any(e['state']=='OUTCOME_UNKNOWN' for e in self.entries):
                raise ValueError('UNKNOWN_BILLING_REQUIRES_RECONCILIATION')
            if self.exposure() + self.reserve_amount > self.maximum + 1e-9:
                raise ValueError('BUDGET_EXCEEDED')
            entry = {'task_id': ident, 'model': model, 'started_at': now(), 'state': 'RESERVED',
                     'charged_or_reserved_usd': self.reserve_amount, 'usage': {}, 'token_cost_usd': None}
            self.entries.append(entry)
            atomic_json(self.path, self.entries)
            return entry

    def settle(self, entry, result, pricing):
        with self.lock:
            usage = result.usage
            details = usage.get('input_tokens_details', {})
            output = usage.get('output_tokens_details', {}).get('image_tokens', usage.get('output_tokens'))
            cost = None
            if output is not None and 'text_tokens' in details and 'image_tokens' in details:
                cost = (details['text_tokens'] * pricing['text_input_per_million'] +
                        details['image_tokens'] * pricing['image_input_per_million'] +
                        output * pricing['image_output_per_million']) / 1_000_000
            entry.update(state='RESPONSE_RECEIVED', usage=usage, token_cost_usd=cost,
                         request_id=result.request_id, finished_at=now())
            # Keep the allowance if actual usage is absent; never claim unknown costs are zero.
            entry['charged_or_reserved_usd'] = cost if cost is not None else self.reserve_amount
            atomic_json(self.path, self.entries)

    def fail(self, entry, ambiguous):
        with self.lock:
            if entry['state'] == 'RESPONSE_RECEIVED':
                return
            entry['state'] = 'OUTCOME_UNKNOWN' if ambiguous else 'REJECTED'
            # Conservatively retain reserves for all failed calls.
            atomic_json(self.path, self.entries)
