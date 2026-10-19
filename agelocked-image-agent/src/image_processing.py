from pathlib import Path
from PIL import Image, ImageOps
from .common import output_file


def dimensions(task, styles):
    return tuple(styles['cover_size' if task['position'] == '封面' else 'inline_size'])


def prepare_image(source, png, webp, size, background='#FAF7F2', quality=85):
    png, webp = Path(png), Path(webp)
    if png.exists() or webp.exists():
        raise ValueError('OUTPUT_EXISTS_NO_OVERWRITE')
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image).convert('RGB')
        # Letterboxing, never stretching or silently cropping scientific elements.
        fitted = ImageOps.contain(image, size, Image.Resampling.LANCZOS)
        canvas = Image.new('RGB', size, background)
        canvas.paste(fitted, ((size[0] - fitted.width) // 2, (size[1] - fitted.height) // 2))
        png.parent.mkdir(parents=True, exist_ok=True)
        webp.parent.mkdir(parents=True, exist_ok=True)
        with png.open('xb') as stream:
            canvas.save(stream, format='PNG')
        with webp.open('xb') as stream:
            canvas.save(stream, format='WEBP', quality=quality)
    return png, webp


def composite_product(background, official_cutout, destination):
    with Image.open(background) as canvas, Image.open(official_cutout) as product:
        if product.mode != 'RGBA' or product.getextrema()[3][0] == 255:
            raise ValueError('OFFICIAL_PRODUCT_CUTOUT_REQUIRED')
        canvas = canvas.convert('RGBA')
        product = ImageOps.contain(product, (int(canvas.width * .34), int(canvas.height * .70)), Image.Resampling.LANCZOS)
        canvas.alpha_composite(product, (int(canvas.width * .77 - product.width / 2), int(canvas.height * .53 - product.height / 2)))
        with Path(destination).open('xb') as stream:
            canvas.save(stream, 'PNG')
    # Package pixels are resampled and alpha-composited; no generative edit touches them.
