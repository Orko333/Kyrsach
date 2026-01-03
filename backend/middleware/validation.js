const { body, param, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Помилка валідації',
      details: errors.array() 
    });
  }
  next();
};

const storyValidation = {
  create: [
    body('title')
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage('Назва має бути від 3 до 100 символів'),
    body('genre')
      .isIn(['фентезі', 'фантастика', 'детектив', 'жахи', 'пригоди', 'романтика', 'містика', 'кіберпанк', 'апокаліпсис', 'стімпанк', 'трилер', 'історичний', 'комедія', 'драма', 'noir', 'космоопера'])
      .withMessage('Невірний жанр'),
    body('setting')
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('Сеттінг має бути від 5 до 500 символів'),
    body('mainCharacter')
      .trim()
      .isLength({ min: 3, max: 300 })
      .withMessage('Опис персонажа має бути від 3 до 300 символів'),
    validate
  ],
  
  addNode: [
    param('id').isMongoId().withMessage('Невірний ID історії'),
    body('content')
      .trim()
      .isLength({ min: 10 })
      .withMessage('Контент має містити мінімум 10 символів'),
    body('choices')
      .isArray({ min: 3, max: 3 })
      .withMessage('Має бути рівно 3 варіанти вибору'),
    validate
  ],
  
  saveChoice: [
    param('id').isMongoId().withMessage('Невірний ID історії'),
      body('nodeId').isMongoId().withMessage('Невірний ID вузла'),
    body('choiceText').trim().notEmpty().withMessage('Текст вибору не може бути порожнім'),
    validate
  ]
};

const aiValidation = {
  generateStart: [
    body('genre')
      .isIn(['фентезі', 'фантастика', 'детектив', 'жахи', 'пригоди', 'романтика', 'містика', 'кіберпанк', 'апокаліпсис', 'стімпанк', 'трилер', 'історичний', 'комедія', 'драма', 'noir', 'космоопера'])
      .withMessage('Невірний жанр'),
    body('setting')
      .trim()
      .isLength({ min: 5, max: 500 })
      .withMessage('Сеттінг має бути від 5 до 500 символів'),
    body('mainCharacter')
      .trim()
      .isLength({ min: 3, max: 300 })
      .withMessage('Опис персонажа має бути від 3 до 300 символів'),
    validate
  ],
  
  continue: [
    body('previousContext')
      .trim()
      .notEmpty()
      .withMessage('Попередній контекст не може бути порожнім'),
    body('userChoice')
      .trim()
      .notEmpty()
      .withMessage('Вибір користувача не може бути порожнім'),
    body('genre').notEmpty().withMessage('Жанр обов\'язковий'),
    body('setting').notEmpty().withMessage('Сеттінг обов\'язковий'),
    body('mainCharacter').notEmpty().withMessage('Персонаж обов\'язковий'),
    validate
  ]
};

module.exports = {
  storyValidation,
  aiValidation
};
