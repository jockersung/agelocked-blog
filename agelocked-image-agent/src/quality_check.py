from pathlib import Path
from PIL import Image, ImageStat


def check_image(path, expected_size, background='#FAF7F2'):
    result = {'passed_technical': False, 'errors': [], 'warnings': [],
              'manual_checks': {'unexpected_text': 'NOT_AUTOMATICALLY_VERIFIED',
                                'style': 'NOT_AUTOMATICALLY_VERIFIED',
                                'scientific_meaning_and_task_match': 'NOT_AUTOMATICALLY_VERIFIED',
                                'cropping': 'NOT_AUTOMATICALLY_VERIFIED',
                                'product_packaging': 'NOT_AUTOMATICALLY_VERIFIED'}}
    if not Path(path).is_file():
        result['errors'].append('FILE_MISSING')
        return result
    try:
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            image = image.convert('RGB')
            result['size'] = list(image.size)
            if image.size != tuple(expected_size):
                result['errors'].append('DIMENSIONS_OR_RATIO_WRONG')
            if max(ImageStat.Stat(image.resize((128, 128))).stddev) < 2:
                result['errors'].append('BLANK_OR_NEAR_UNIFORM')
            small = image.resize((128, 128))
            corners = [small.getpixel(p) for p in [(0, 0), (127, 0), (0, 127), (127, 127)]]
            target = tuple(int(background[i:i+2], 16) for i in [1, 3, 5])
            if sum(sum(abs(a-b) for a,b in zip(c, target)) < 70 for c in corners) < 3:
                result['warnings'].append('BACKGROUND_NEEDS_REVIEW')
            pixels = small.get_flattened_data() if hasattr(small,'get_flattened_data') else small.getdata()
            if sum(sum(p)/3 < 55 for p in pixels) / (128 * 128) > .45:
                result['warnings'].append('EXCESS_DARK_PIXELS')
    except Exception:
        result['errors'].append('IMAGE_UNREADABLE')
    result['passed_technical'] = not result['errors']
    return result
