const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken, protect } = require('../middleware/auth');
const { body } = require('express-validator');
const { validationResult } = require('express-validator');

// Validation schemas
const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Ім\'я користувача має бути від 3 до 30 символів')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Ім\'я користувача може містити лише літери, цифри та підкреслення'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Невірний формат email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Пароль має бути не менше 6 символів'),
];

const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Невірний формат email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Пароль обов\'язковий'),
];

// @route   POST /api/auth/register
// @desc    Реєстрація нового користувача
// @access  Public
router.post('/register', registerValidation, async (req, res, next) => {
  try {
    // Перевірка валідації
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { username, email, password, bio } = req.body;

    // Перевіряємо чи користувач вже існує
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email 
          ? 'Користувач з таким email вже існує' 
          : 'Користувач з таким ім\'ям вже існує',
      });
    }

    // Створюємо нового користувача
    const user = await User.create({
      username,
      email,
      password,
      bio: bio || '',
    });

    // Генеруємо токен
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Користувача успішно зареєстровано',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        backgroundImage: user.backgroundImage || null,
        bio: user.bio,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/login
// @desc    Вхід користувача
// @access  Public
router.post('/login', loginValidation, async (req, res, next) => {
  try {
    // Перевірка валідації
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Знаходимо користувача (включаємо пароль)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Невірний email або пароль',
      });
    }

    // Перевіряємо пароль
    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Невірний email або пароль',
      });
    }

    // Оновлюємо lastLogin
    user.lastLogin = Date.now();
    await user.save();

    // Генеруємо токен
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Вхід виконано успішно',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        backgroundImage: user.backgroundImage || null,
        bio: user.bio,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/auth/me
// @desc    Отримати поточного користувача
// @access  Private
router.get('/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        backgroundImage: user.backgroundImage || null,
        bio: user.bio,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/auth/profile
// @desc    Оновити профіль користувача
// @access  Private
router.put('/profile', protect, [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Ім\'я користувача має бути від 3 до 30 символів'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Біографія має бути не більше 500 символів'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { username, bio, avatar } = req.body;
    const updateFields = {};

    if (username && username !== req.user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Користувач з таким ім\'ям вже існує',
        });
      }
      updateFields.username = username;
    }

  if (bio !== undefined) updateFields.bio = bio;
    if (avatar !== undefined) updateFields.avatar = avatar;
  // allow backgroundImage update via profile route
  if (req.body.backgroundImage !== undefined) updateFields.backgroundImage = req.body.backgroundImage;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Профіль оновлено успішно',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        backgroundImage: user.backgroundImage || null,
        bio: user.bio,
      },
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/auth/background
// @desc    Оновити background користувача (окремий ендпоінт для спрощення)
// @access  Private
router.put('/background', protect, async (req, res, next) => {
  try {
    const { backgroundImage } = req.body;
    if (!backgroundImage) {
      return res.status(400).json({ success: false, message: 'backgroundImage is required' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { backgroundImage },
      { new: true }
    );

    res.json({ success: true, message: 'Background updated', backgroundImage: user.backgroundImage });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
