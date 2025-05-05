// src/models/Thread.js
const mongoose = require('mongoose');

const threadSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const Thread = mongoose.model('Thread', threadSchema);
module.exports = Thread;