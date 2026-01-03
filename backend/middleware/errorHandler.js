const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Помилка валідації даних',
      details: Object.values(err.errors).map(e => e.message)
    });
  }

  // Mongoose cast error (невірний ID)
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Невірний формат ID'
    });
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    return res.status(400).json({
      error: 'Такий запис вже існує'
    });
  }

  // Axios error (API calls)
  if (err.isAxiosError) {
    return res.status(503).json({
      error: 'Помилка зв\'язку з зовнішнім сервісом',
      details: err.message
    });
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Внутрішня помилка сервера'
  });
};

const notFound = (req, res) => {
  res.status(404).json({
    error: 'Маршрут не знайдено'
  });
};

module.exports = {
  errorHandler,
  notFound
};
