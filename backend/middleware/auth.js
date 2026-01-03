const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

// Генерація JWT токена
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRE,
  });
};

// Middleware для перевірки авторизації
const protect = async (req, res, next) => {
  let token;

  // Перевіряємо наявність токена в headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Доступ заборонено. Потрібна авторизація.',
    });
  }

  try {
    // Верифікуємо токен
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Отримуємо користувача з БД
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Користувача не знайдено.',
      });
    }

    // Додаємо користувача до request
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({
      success: false,
      message: 'Токен недійсний або застарілий.',
    });
  }
};

// Optional middleware - не вимагає авторизації, але додає user якщо токен є
const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (user) {
      req.user = user;
    }
  } catch (error) {
    // Ігноруємо помилки для optional auth
    console.log('Optional auth failed:', error.message);
  }
  
  next();
};

module.exports = { protect, optionalAuth, generateToken };
