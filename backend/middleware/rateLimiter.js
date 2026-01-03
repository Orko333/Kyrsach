const rateLimit = require('express-rate-limit');

// Загальний rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 хвилин
  max: 100, // 100 запитів
  message: { error: 'Занадто багато запитів. Спробуйте пізніше.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter для AI генерації
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 хвилина
  max: 10, // 10 запитів
  message: { error: 'Забагато запитів до AI. Зачекайте хвилину.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter для створення історій
const createLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 хвилина
  max: 5, // 5 нових історій
  message: { error: 'Забагато нових історій. Зачекайте хвилину.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  aiLimiter,
  createLimiter
};
