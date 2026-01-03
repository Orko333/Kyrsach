const express = require('express');
const router = express.Router();
const Story = require('../models/Story');
const { storyValidation } = require('../middleware/validation');
const { createLimiter } = require('../middleware/rateLimiter');
const { protect, optionalAuth } = require('../middleware/auth');
const User = require('../models/User');

// Отримати всі історії з пагінацією (публічні + свої приватні)
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Фільтр: публічні історії АБО історії поточного користувача
    const filter = req.user 
      ? { $or: [{ isPublic: true }, { user: req.user.id }] }
      : { isPublic: true };

    const stories = await Story.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username avatar')
      .select('title genre status createdAt updatedAt nodes user isPublic likes views');
    
    const total = await Story.countDocuments(filter);
    
    res.json({
      stories,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Отримати історії поточного користувача - ВАЖЛИВО: перед /:id
router.get('/my/stories', protect, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const stories = await Story.find({ user: req.user.id })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('title genre status createdAt updatedAt nodes isPublic likes views');
    
    const total = await Story.countDocuments({ user: req.user.id });
    
    res.json({
      stories,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Отримати конкретну історію
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id).populate('user', 'username avatar');
    
    if (!story) {
      return res.status(404).json({ error: 'Історію не знайдено' });
    }

    // Перевіряємо доступ: публічна АБО власна історія
    if (!story.isPublic && (!req.user || story.user._id.toString() !== req.user.id)) {
      return res.status(403).json({ error: 'Доступ заборонено' });
    }

    // Збільшуємо лічильник переглядів (якщо не власник)
    if (!req.user || story.user._id.toString() !== req.user.id) {
      story.views += 1;
      await story.save();
    }

    res.json(story);
  } catch (error) {
    next(error);
  }
});

// Створити нову історію
router.post('/', protect, createLimiter, storyValidation.create, async (req, res, next) => {
  try {
    const { title, genre, setting, mainCharacter, isPublic } = req.body;
    
    const story = new Story({
      title,
      genre,
      setting,
      mainCharacter,
      user: req.user.id,
      isPublic: isPublic || false,
      nodes: []
    });

    await story.save();
    res.status(201).json(story);
  } catch (error) {
    next(error);
  }
});

// Додати вузол до історії
router.post('/:id/nodes', protect, storyValidation.addNode, async (req, res, next) => {
  try {
    const { content, imageUrl, choices, parentNodeId, parentChoiceText, parentChoiceIndex } = req.body;
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return res.status(404).json({ error: 'Історію не знайдено' });
    }

    // Перевіряємо, чи користувач є власником історії
    if (story.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Ви не можете редагувати цю історію' });
    }

    const newNode = {
      content,
      imageUrl,
      choices,
      parentNodeId: parentNodeId || null,
      parentChoiceText: parentChoiceText || null,
      parentChoiceIndex: Number.isFinite(parentChoiceIndex) ? parentChoiceIndex : (parentChoiceIndex === 0 ? 0 : null)
    };

    // If imageUrl is an inline data URL (base64), persist to uploads and replace with URL
    if (newNode.imageUrl && typeof newNode.imageUrl === 'string' && newNode.imageUrl.startsWith('data:')) {
      try {
        const match = newNode.imageUrl.match(/^data:(.+);base64,(.*)$/);
        if (match) {
          const mime = match[1];
          const b64 = match[2];
          const buffer = Buffer.from(b64, 'base64');
          const maxSize = 8 * 1024 * 1024; // 8MB limit per image
          if (buffer.length <= maxSize) {
            const ext = mime === 'image/png' ? '.png' : mime === 'image/jpeg' ? '.jpg' : mime === 'image/webp' ? '.webp' : '';
            if (ext) {
              const path = require('path');
              const fs = require('fs');
              const uploadsDir = path.join(__dirname, '../uploads');
              if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
              const filename = `ai_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
              const filePath = path.join(uploadsDir, filename);
              fs.writeFileSync(filePath, buffer);
              newNode.imageUrl = `/uploads/${filename}`;
            } else {
              // Unsupported mime: drop image
              newNode.imageUrl = null;
            }
          } else {
            // Image too large: drop it
            newNode.imageUrl = null;
          }
        } else {
          newNode.imageUrl = null;
        }
      } catch (err) {
        console.warn('Failed to persist inline image:', err.message || err);
        newNode.imageUrl = null;
      }
    }

    story.nodes.push(newNode);
    await story.save();

    // Якщо вузол має зображення і користувач - автор, оновимо його backgroundImage
    if (imageUrl) {
      await User.findByIdAndUpdate(req.user.id, { backgroundImage: imageUrl });
    }
    
    res.json(story);
  } catch (error) {
    next(error);
  }
});

// Зберегти вибір користувача
router.post('/:id/choice', protect, storyValidation.saveChoice, async (req, res, next) => {
  try {
    const { nodeId, choiceText } = req.body;
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return res.status(404).json({ error: 'Історію не знайдено' });
    }

    // Перевіряємо, чи користувач є власником історії
    if (story.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Ви не можете змінювати цю історію' });
    }

    const node = story.nodes.id(nodeId);
    if (!node) {
      return res.status(400).json({ error: 'Вузол не знайдено' });
    }

    // Додаємо новий вибір до масиву виборів
    node.userChoices.push({ 
      text: choiceText,
      nodeId: nodeId
    });
    
    await story.save();

    res.json(story);
  } catch (error) {
    next(error);
  }
});

// Перемкнути публічність історії
router.patch('/:id/toggle-public', protect, async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return res.status(404).json({ error: 'Історію не знайдено' });
    }

    if (story.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Ви не можете змінювати цю історію' });
    }

    story.isPublic = !story.isPublic;
    await story.save();

    res.json({ 
      message: `Історія тепер ${story.isPublic ? 'публічна' : 'приватна'}`,
      story 
    });
  } catch (error) {
    next(error);
  }
});

// Лайкнути історію
router.post('/:id/like', protect, async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return res.status(404).json({ error: 'Історію не знайдено' });
    }

    const likeIndex = story.likes.indexOf(req.user.id);
    
    if (likeIndex > -1) {
      // Вже лайкнуто - прибираємо лайк
      story.likes.splice(likeIndex, 1);
    } else {
      // Додаємо лайк
      story.likes.push(req.user.id);
    }

    await story.save();

    res.json({ 
      message: likeIndex > -1 ? 'Лайк видалено' : 'Лайк додано',
      likes: story.likes.length,
      isLiked: likeIndex === -1
    });
  } catch (error) {
    next(error);
  }
});

// Видалити історію
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return res.status(404).json({ error: 'Історію не знайдено' });
    }

    // Перевіряємо, чи користувач є власником історії
    if (story.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Ви не можете видалити цю історію' });
    }

    await Story.findByIdAndDelete(req.params.id);
    res.json({ message: 'Історію успішно видалено', id: req.params.id });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
