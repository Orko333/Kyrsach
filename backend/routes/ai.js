const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const fs = require('fs');
let sharp = null;
try {
  // Optional dependency; if not installed, we fall back to saving the original.
  sharp = require('sharp');
} catch {}
const openrouterService = require('../services/openrouterService');
const { aiValidation } = require('../middleware/validation');
const { aiLimiter } = require('../middleware/rateLimiter');

function extFromContentType(contentType) {
  if (!contentType) return '';
  const ct = String(contentType).toLowerCase();
  if (ct.includes('image/png')) return '.png';
  if (ct.includes('image/jpeg')) return '.jpg';
  if (ct.includes('image/webp')) return '.webp';
  if (ct.includes('image/gif')) return '.gif';
  return '';
}

async function proxyImageToUploads(imageUrl) {
  const pollinationsKey = process.env.POLLINATIONS_API_KEY;
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 60000,
    headers: {
      // Some providers behave better with a browser-like UA.
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'image/*',
      ...(pollinationsKey ? { 'Authorization': `Bearer ${pollinationsKey}` } : null)
    },
    // Pollinations sometimes redirects.
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const contentType = response.headers?.['content-type'] || '';
  if (!String(contentType).toLowerCase().startsWith('image/')) {
    throw new Error(`Upstream did not return an image (content-type=${contentType || 'unknown'})`);
  }

  const buffer = Buffer.from(response.data);
  // Basic sanity: reject tiny payloads (often placeholders or errors rendered as small images)
  if (buffer.length < 12 * 1024) {
    throw new Error(`Upstream image too small (${buffer.length} bytes)`);
  }

  // Normalize image so it doesn't break UI: 16:9 crop and PNG output for best quality.
  let outBuffer = buffer;
  let ext = '.png';
  if (sharp) {
    outBuffer = await sharp(buffer)
      .rotate()
      .resize(1920, 1080, { fit: 'cover' })
      .png({ quality: 100, compressionLevel: 6 })
      .toBuffer();
  } else {
    // Fallback: keep original type/extension
    ext = extFromContentType(contentType) || '.png';
  }

  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const filename = `poll_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, outBuffer);

  return `/uploads/${filename}`;
}

// Генерувати початок історії
router.post('/generate-start', aiLimiter, aiValidation.generateStart, async (req, res, next) => {
  try {
    const { genre, setting, mainCharacter } = req.body;
    
    const result = await openrouterService.generateStoryStart(genre, setting, mainCharacter);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Продовжити історію
router.post('/continue', aiLimiter, aiValidation.continue, async (req, res, next) => {
  try {
    const { previousContext, userChoice, genre, setting, mainCharacter } = req.body;
    
    const result = await openrouterService.continueStory(
      previousContext,
      userChoice,
      genre,
      setting,
      mainCharacter
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Генерувати зображення для сцени
router.post('/generate-image', aiLimiter, async (req, res, next) => {
  try {
    const { sceneDescription, genre, setting, style, quality } = req.body;
    
    if (!sceneDescription || !genre || !setting) {
      return res.status(400).json({ 
        error: 'sceneDescription, genre та setting обов\'язкові' 
      });
    }
    
    let imageUrl = await openrouterService.generateImage(sceneDescription, genre, setting, style, quality);

    // Prefer returning a local URL to avoid client-side blocking/caching issues with upstream hosts.
    if (
      imageUrl &&
      typeof imageUrl === 'string' &&
      (imageUrl.startsWith('https://image.pollinations.ai/') || imageUrl.startsWith('https://gen.pollinations.ai/'))
    ) {
      try {
        // Try up to 3 times in case upstream returns a placeholder.
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            imageUrl = await proxyImageToUploads(imageUrl);
            break;
          } catch (e) {
            if (attempt === 2) throw e;
            // Re-generate a new URL (new variation token) and retry.
            imageUrl = await openrouterService.generateImage(sceneDescription, genre, setting, style, quality);
          }
        }
      } catch (e) {
        console.warn('Failed to proxy Pollinations image, returning upstream url as fallback:', e?.message || e);
        // Keep upstream URL as last resort
        imageUrl = imageUrl;
      }
    }

    res.json({ imageUrl });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
