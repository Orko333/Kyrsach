const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const Story = require('../models/Story');

// Upload одного зображення
router.post('/upload', protect, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Зображення не завантажено',
      });
    }

    // Повертаємо URL зображення
    const imageUrl = `/uploads/${req.file.filename}`;
    
    res.json({
      success: true,
      message: 'Зображення успішно завантажено',
      imageUrl,
      filename: req.file.filename,
      size: req.file.size,
    });
  } catch (error) {
    next(error);
  }
});

// Upload множинних зображень
router.post('/upload-multiple', protect, upload.array('images', 5), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Зображення не завантажено',
      });
    }

    const images = req.files.map(file => ({
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      size: file.size,
    }));

    res.json({
      success: true,
      message: `Успішно завантажено ${images.length} зображень`,
      images,
    });
  } catch (error) {
    next(error);
  }
});

// Видалити зображення
router.delete('/:filename', protect, async (req, res, next) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../uploads', filename);

    // Перевіряємо чи файл існує
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Зображення не знайдено',
      });
    }

    // Видаляємо файл
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: 'Зображення успішно видалено',
    });
  } catch (error) {
    next(error);
  }
});

// GET random image from story nodes (used as fallback when user has no background)
router.get('/random', async (req, res, next) => {
  try {
    // Aggregate nodes with imageUrl and sample one
    const result = await Story.aggregate([
      { $unwind: '$nodes' },
      { $match: { 'nodes.imageUrl': { $exists: true, $ne: null } } },
      { $sample: { size: 1 } },
      { $project: { imageUrl: '$nodes.imageUrl' } }
    ]);

    if (!result || result.length === 0) {
      return res.status(404).json({ success: false, message: 'No images found' });
    }

    res.json({ success: true, imageUrl: result[0].imageUrl });
  } catch (error) {
    next(error);
  }
});

// Save image from base64 data URL -> returns file URL in /uploads
router.post('/from-base64', protect, async (req, res, next) => {
  try {
    const { dataUrl } = req.body;
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      return res.status(400).json({ success: false, message: 'Invalid dataUrl' });
    }

    // Parse data URL
    const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Invalid dataUrl format' });
    }
    const mime = match[1];
    const b64 = match[2];
    const buffer = Buffer.from(b64, 'base64');

    // Optional size guard: limit ~8MB
    const maxSize = 8 * 1024 * 1024;
    if (buffer.length > maxSize) {
      return res.status(413).json({ success: false, message: 'Image too large' });
    }

    // Determine extension
    const ext = mime === 'image/png' ? '.png' : mime === 'image/jpeg' ? '.jpg' : mime === 'image/webp' ? '.webp' : '';
    if (!ext) {
      return res.status(400).json({ success: false, message: `Unsupported mime type: ${mime}` });
    }

    // Ensure uploads dir exists
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const filename = `ai_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);
    const url = `/uploads/${filename}`;

    return res.json({ success: true, imageUrl: url, filename });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
