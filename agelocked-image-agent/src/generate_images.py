from pathlib import Path
from .common import exclusive_bytes, output_file
from .image_provider import with_retries
from .image_processing import prepare_image, dimensions, composite_product
from .quality_check import check_image
from .prompt_builder import build_prompt


def generate_task(task, root, settings, styles, templates, provider, tracker, budget):
    root = Path(root).resolve()
    raw = output_file(root, task, 'raw')
    png, webp = output_file(root, task, 'png'), output_file(root, task, 'webp')
    if raw.exists() or png.exists() or webp.exists():
        raise ValueError('EXISTING_OUTPUT_REQUIRES_RECONCILIATION')
    entry = budget.reserve(task['id'], settings['model'])
    tracker.update(task, 'GENERATING', error=None)
    try:
        result = with_retries(lambda: provider.generate(build_prompt(task, templates), task['references']),
                              settings['max_retries'], max_delay=settings['max_retry_delay_seconds'])
        # Persist billable result BEFORE any image processing which could fail.
        exclusive_bytes(raw, result.image)
        budget.settle(entry, result, settings['pricing'])
        tracker.update(task, 'GENERATED', raw=raw.relative_to(root).as_posix(),
                       model=result.model, usage=result.usage, request_id=result.request_id,
                       token_cost_usd=entry['token_cost_usd'])
        source = raw
        if task['type'] == 'D':
            source = raw.with_name('product-composite.png')
            composite_product(raw, task['product_photo'], source)
        prepare_image(source, png, webp, dimensions(task, styles), styles['background'], settings['webp_quality'])
        qa = check_image(png, dimensions(task, styles), styles['background'])
        qa['webp'] = check_image(webp, dimensions(task, styles), styles['background'])
        tracker.update(task, 'REVIEW_REQUIRED', png=png.relative_to(root).as_posix(),
                       webp=webp.relative_to(root).as_posix(), qa=qa, review_required=True)
    except Exception as error:
        from .image_provider import ProviderError
        ambiguous = getattr(error, 'ambiguous', False) or raw.exists()
        budget.fail(entry, ambiguous)
        code = error.code if isinstance(error, ProviderError) else type(error).__name__
        tracker.update(task, 'REVIEW_REQUIRED' if ambiguous else 'FAILED', error=code)
        # Unknown outcomes halt the dispatch window. Already in-flight requests may finish.
        if ambiguous:
            raise ValueError('REQUEST_OUTCOME_REQUIRES_REVIEW') from None
