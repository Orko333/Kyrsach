const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Потрібно вказати ім\'я користувача'],
    unique: true,
    trim: true,
    minlength: [3, 'Ім\'я користувача має бути не менше 3 символів'],
    maxlength: [30, 'Ім\'я користувача має бути не більше 30 символів'],
  },
  email: {
    type: String,
    required: [true, 'Потрібно вказати email'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Невірний формат email'],
  },
  password: {
    type: String,
    required: [true, 'Потрібно вказати пароль'],
    minlength: [6, 'Пароль має бути не менше 6 символів'],
    select: false, // За замовчуванням не повертаємо пароль
  },
  avatar: {
    type: String,
    default: null,
  },
  backgroundImage: {
    type: String,
    default: null,
  },
  bio: {
    type: String,
    maxlength: [500, 'Біографія має бути не більше 500 символів'],
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
});

// Хешуємо пароль перед збереженням
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Метод для перевірки пароля
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Помилка перевірки пароля');
  }
};

// Метод для отримання публічних даних користувача
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
