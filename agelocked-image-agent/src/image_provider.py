"""Real OpenAI Images HTTP adapter. Unit tests inject transport and never use the network."""
import base64
import io
import json
import mimetypes
import os
import random
import socket
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from PIL import Image


class ProviderError(Exception):
    def __init__(self, code, retryable=False, ambiguous=False, retry_after=0):
        super().__init__(code)
        self.code, self.retryable, self.ambiguous, self.retry_after = code, retryable, ambiguous, retry_after


@dataclass
class ImageResult:
    image: bytes
    usage: dict
    request_id: str | None
    model: str


class ImageProvider(Protocol):
    def generate(self, prompt: str, references: list[str]) -> ImageResult: ...


def multipart(fields, references):
    boundary = uuid.uuid4().hex
    pieces = []
    for key, value in fields.items():
        pieces.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode('utf-8'))
    for index, filename in enumerate(references):
        path = Path(filename)
        data = path.read_bytes()
        if len(data) >= 50 * 1024 * 1024:
            raise ProviderError('REFERENCE_IMAGE_TOO_LARGE')
        mime = mimetypes.guess_type(path.name)[0] or 'image/png'
        pieces.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image[]"; filename="reference-{index}{path.suffix}"\r\nContent-Type: {mime}\r\n\r\n'.encode('ascii') + data + b'\r\n')
    pieces.append(f'--{boundary}--\r\n'.encode('ascii'))
    return b''.join(pieces), f'multipart/form-data; boundary={boundary}'


class OpenAIProvider:
    def __init__(self, settings, transport=None):
        self.settings, self.transport = settings, transport or urlopen

    def generate(self, prompt, references):
        key = os.getenv('OPENAI_API_KEY')
        if not key:
            raise ProviderError('OPENAI_API_KEY_MISSING')
        if self.settings['model'] != 'gpt-image-2':
            raise ProviderError('MODEL_NOT_PRICED_AND_VALIDATED')
        if len(references) > 16:
            raise ProviderError('TOO_MANY_REFERENCES')
        fields = {'model': self.settings['model'], 'prompt': prompt, 'n': 1,
                  'size': self.settings['api_size'], 'quality': self.settings['quality'],
                  'output_format': 'png', 'background': 'opaque'}
        if references:
            body, content_type = multipart(fields, references)
            endpoint = 'edits'
        else:
            body, content_type = json.dumps(fields).encode(), 'application/json'
            endpoint = 'generations'
        request = Request('https://api.openai.com/v1/images/' + endpoint, body,
                          {'Authorization': 'Bearer ' + key, 'Content-Type': content_type}, method='POST')
        # No request headers, complete response body or exception text enters logs.
        try:
            with self.transport(request, timeout=self.settings['request_timeout_seconds']) as response:
                raw = json.loads(response.read())
                request_id = response.headers.get('x-request-id')
        except HTTPError as error:
            code = 'HTTP_' + str(error.code)
            try:
                details = json.loads(error.read()).get('error', {})
                api_code = details.get('code')
            except Exception:
                api_code = None
            # Only explicit temporary throttles/overload are safe for automatic retry.
            retry = error.code in {429, 503} and api_code in {'rate_limit_exceeded', 'slow_down', 'server_is_overloaded'}
            try:
                delay = max(0, float(error.headers.get('Retry-After', '0')))
            except (ValueError, TypeError):
                delay = self.settings['max_retry_delay_seconds'] + 1
            raise ProviderError(code, retryable=retry, ambiguous=error.code >= 500 and not retry,
                                retry_after=delay) from None
        except (socket.timeout, TimeoutError, URLError, ConnectionError):
            raise ProviderError('NETWORK_OUTCOME_UNKNOWN', ambiguous=True) from None
        except Exception:
            raise ProviderError('RESPONSE_OUTCOME_UNKNOWN', ambiguous=True) from None
        try:
            image = base64.b64decode(raw['data'][0]['b64_json'], validate=True)
            with Image.open(io.BytesIO(image)) as decoded:
                decoded.verify()
            return ImageResult(image, raw.get('usage') or {}, request_id, fields['model'])
        except Exception:
            raise ProviderError('INVALID_IMAGE_RESPONSE', ambiguous=True) from None


def with_retries(call, max_retries, sleep=time.sleep, max_delay=60):
    for attempt in range(max_retries + 1):
        try:
            return call()
        except ProviderError as error:
            if not error.retryable or error.ambiguous or attempt == max_retries:
                raise
            delay = max(error.retry_after, min(2 ** attempt, 30)) + random.random()
            if delay > max_delay:
                raise ProviderError('RATE_LIMIT_DEFERRED') from None
            sleep(delay)


def create_provider(settings):
    if settings['provider'] != 'openai':
        raise ProviderError('UNREGISTERED_PROVIDER')
    if not os.getenv('OPENAI_API_KEY'):
        raise ProviderError('OPENAI_API_KEY_MISSING')
    return OpenAIProvider(settings)
