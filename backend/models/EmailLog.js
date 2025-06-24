const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  type: { type: String, required: true },
  recipient: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('EmailLog', emailLogSchema);