def build_prompt(task, templates):
    if task['type'] == 'C' or task.get('reuse_of'):
        raise ValueError('TASK_DOES_NOT_USE_GENERATIVE_IMAGE_API')
    if task['type'] == 'D':
        # Do not send Excel's full-product prompt into image generation.
        return templates['product'] + '\n' + templates['general']
    parts = [task['prompt'], templates['general']]
    if '照原構圖' in task['action']:
        parts.append(templates['redraw'])
    if task['type']=='A' and task.get('article_title'):
        # User's updated cover policy: full title, large type, at most two lines.
        parts=[p.replace('no text, no letters, no numbers, no logos','no additional labels or logos')
                .replace('No text, letters, numbers, logos','No additional labels or logos') for p in parts]
        parts.append('USER COVER TITLE OVERRIDE: Disregard earlier no-text or blank-heading instructions ONLY for the title. '
                     'Render the COMPLETE article title verbatim in large bold Traditional Chinese typography, '
                     'deep teal, at most TWO lines. Adjust type size to preserve the full title without clipping. '
                     'No other text. Exact title: '+task['article_title'])
    return '\n\n'.join(parts)
