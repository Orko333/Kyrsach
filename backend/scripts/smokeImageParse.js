const openrouterService = require('../services/openrouterService');

function test(name, messageObj) {
  const img = openrouterService.extractImageFromAny(messageObj);
  console.log(`\n[${name}]`);
  console.log('extracted:', img ? (img.startsWith('data:image') ? `data:image...(len=${img.length})` : img) : null);
}

// 1) Plain URL in string content
test('string-url', { role: 'assistant', content: 'https://example.com/image.png' });

// 2) Markdown image
test('markdown', { role: 'assistant', content: '![img](https://example.com/a/b/c.jpg)' });

// 3) Multimodal parts: image_url
test('parts-image_url', {
  role: 'assistant',
  content: [
    { type: 'text', text: 'Here is your image' },
    { type: 'image_url', image_url: { url: 'https://example.com/generated.webp' } }
  ]
});

// 4) Multimodal parts: image base64 payload
const fakePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XkKXcAAAAASUVORK5CYII=';
// Repeat to exceed the base64 length threshold (smoke test only)
const bigBase64 = fakePngBase64.repeat(10);

test('parts-image-data', {
  role: 'assistant',
  content: [
    { type: 'image', image: { data: bigBase64, mime_type: 'image/png' } }
  ]
});

// 5) OpenAI-like b64_json object
const b64 = fakePngBase64.repeat(10);

test('b64_json', {
  role: 'assistant',
  content: [{ b64_json: b64, mime_type: 'image/png' }]
});

// 6) Ensure plain text doesn't become data:image
test('plain-text', { role: 'assistant', content: 'Hello world, not an image.' });
