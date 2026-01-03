const mongoose = require('mongoose');

const ChoiceSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  chosenAt: {
    type: Date,
    default: Date.now
  },
  nodeId: {
    type: mongoose.Schema.Types.ObjectId
  }
});

const StoryNodeSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String
  },
  choices: [String],
  userChoices: [ChoiceSchema], // Масив виборів для підтримки множинних проходжень
  parentNodeId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  parentChoiceText: {
    type: String,
    default: null
  },
  parentChoiceIndex: {
    type: Number,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const StorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  genre: {
    type: String,
    required: true,
    enum: ['фентезі', 'фантастика', 'детектив', 'жахи', 'пригоди', 'романтика', 'містика', 'кіберпанк', 'апокаліпсис', 'стімпанк', 'трилер', 'історичний', 'комедія', 'драма', 'noir', 'космоопера']
  },
  setting: {
    type: String,
    required: true
  },
  mainCharacter: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  views: {
    type: Number,
    default: 0
  },
  nodes: [StoryNodeSchema],
  status: {
    type: String,
    enum: ['active', 'completed', 'archived'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

StorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Story', StorySchema);
