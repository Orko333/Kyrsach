const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();

// Render/Heroku-like platforms run behind a reverse proxy
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));
app.use(generalLimiter);

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
if (!process.env.MONGODB_URI) {
  const message = 'MONGODB_URI not set — please configure environment variables';
  if ((process.env.NODE_ENV || 'development') === 'production') {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
  console.warn(message);
} else {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB підключено успішно'))
    .catch((err) => {
      console.error('❌ Помилка підключення до MongoDB:', err);
      if ((process.env.NODE_ENV || 'development') === 'production') {
        process.exit(1);
      }
    });
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/stories', require('./routes/stories'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/images', require('./routes/images'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Сервер працює',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
  const message = 'JWT_SECRET not set (or using default) — set a strong secret in production';
  if ((process.env.NODE_ENV || 'development') === 'production') {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
  console.warn(message);
}

if (!process.env.GROQ_API_KEY && !process.env.OPENROUTER_API_KEY) {
  console.warn('GROQ_API_KEY / OPENROUTER_API_KEY not set — AI features will use mocked responses for development');
}

// Serve React build in production (single-service deploy)
if ((process.env.NODE_ENV || 'development') === 'production') {
  const buildPath = path.join(__dirname, '../frontend/build');
  app.use(express.static(buildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Сервер запущено на порті ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Порт ${PORT} вже використовується. Спробуйте перезапустити процес або змінити порт.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
