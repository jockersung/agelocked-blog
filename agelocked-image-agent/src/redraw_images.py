from .generate_images import generate_task


def redraw_task(task, *args, **kwargs):
    if '照原構圖' in task['action'] and not task['references']:
        raise ValueError('ORIGINAL_REFERENCE_REQUIRED')
    return generate_task(task, *args, **kwargs)
