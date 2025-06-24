const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  password: { type: String, required: true },
  bank: { type: String },
  profileSet: { type: Boolean, default: false },
  twoFAEnabled: { type: Boolean, default: false },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referralCode: { type: String, unique: true, default: () => Math.random().toString(36).substring(2, 10) },
  level: { type: Number, default: 1 },
  balance: {
    available: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
  },
  pendingPayment: {
    amount: Number,
    level: Number,
    isUpgrade: Boolean,
  },
  status: { type: String, enum: ['pending', 'active', 'suspended', 'verified'], default: 'pending' },
  verificationToken: { type: String },
  tasksCompleted: [
    {
      task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
      date: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);