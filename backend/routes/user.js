const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Task = require('../models/Task');
const Withdrawal = require('../models/Withdrawal');
const Referral = require('../models/Referral');
const Upgrade = require('../models/Upgrade');
const PaymentMethod = require('../models/PaymentMethod');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const { initPayment, verifyPayment } = require('../utils/payment');

router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -verificationToken');
    res.json({
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || 'N/A',
      bank: user.bank || 'N/A',
      level: user.level || 1,
      balance: user.balance,
      avatar: 'https://via.placeholder.com/50', // Hardcoded as per main.js
      name: user.fullName, // Alias for welcome messages
      profileSet: user.profileSet,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/profile', auth, async (req, res) => {
  try {
    const { username, bank } = req.body;
    const user = await User.findById(req.user._id);
    if (user.profileSet) return res.status(400).json({ error: 'Profile details cannot be changed' });

    if (username) {
      const existingUser = await User.findOne({ username });
      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      user.username = username;
    }
    if (bank) user.bank = bank;
    user.profileSet = true;
    await user.save();

    res.json({
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || 'N/A',
      bank: user.bank || 'N/A',
      level: user.level || 1,
      balance: user.balance,
      avatar: 'https://via.placeholder.com/50',
      name: user.fullName,
      profileSet: user.profileSet,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/security', auth, async (req, res) => {
  try {
    const { newPassword, twoFAEnabled } = req.body;
    const user = await User.findById(req.user._id);

    if (!newPassword && twoFAEnabled === undefined) {
      return res.status(400).json({ error: 'No changes provided' });
    }

    if (newPassword) {
      user.password = await bcrypt.hash(newPassword, 10);
    }
    if (twoFAEnabled !== undefined) {
      user.twoFAEnabled = twoFAEnabled;
    }
    await user.save();
    res.json({ message: 'Security settings updated' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      total: user.balance.available + user.balance.pending,
      available: user.balance.available,
      pending: user.balance.pending,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/payment-methods', auth, async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.find({ user: req.user._id });
    res.json(
      paymentMethods.map((method) => ({
        id: method._id,
        type: method.type,
        bank: method.bank,
        accountNumber: method.accountNumber,
        email: method.email,
      }))
    );
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/payment-methods/:id', auth, async (req, res) => {
  try {
    const paymentMethod = await PaymentMethod.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!paymentMethod) return res.status(404).json({ error: 'Payment method not found' });
    res.json({ message: 'Payment method deleted' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/transactions', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id });
    res.json(
      transactions.map((tx) => ({
        date: tx.date.toISOString().split('T')[0],
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        status: tx.status,
      }))
    );
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/referrals/stats', auth, async (req, res) => {
  try {
    const referrals = await Referral.find({ referrer: req.user._id });
    const count = referrals.length;
    const earnings = referrals.reduce((sum, ref) => sum + ref.bonus, 0);
    res.json({ count, earnings });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/referrals', auth, async (req, res) => {
  try {
    const referrals = await Referral.find({ referrer: req.user._id }).populate('referredUser');
    res.json(
      referrals.map((ref) => ({
        name: ref.referredUser.fullName,
        level: ref.referredUser.level,
        joined: ref.createdAt.toISOString().split('T')[0],
        earnings: ref.bonus,
        verified: ref.referredUser.status === 'verified' || ref.referredUser.status === 'active',
      }))
    );
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/tasks/complete', auth, async (req, res) => {
  try {
    const { reward } = req.body; // Hardcoded to 300 in main.js
    if (reward !== 300) return res.status(400).json({ error: 'Invalid reward amount' });

    const user = await User.findById(req.user._id);
    const today = new Date().toISOString().split('T')[0];
    const lastTask = user.tasksCompleted[user.tasksCompleted.length - 1];
    const lastTaskDate = lastTask ? lastTask.date.toISOString().split('T')[0] : null;

    if (lastTaskDate === today) {
      return res.status(400).json({ error: 'Task already completed today' });
    }

    // Find or create default YouTube task
    let task = await Task.findOne({ title: 'Watch Daily YouTube Video' });
    if (!task) {
      task = new Task({
        title: 'Watch Daily YouTube Video',
        link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        reward: 300,
        status: 'active',
      });
      await task.save();
    }

    user.balance.available += reward;
    user.tasksCompleted.push({ task: task._id, date: new Date() });
    task.completions.push(user._id);
    await user.save();
    await task.save();

    const transaction = new Transaction({
      user: user._id,
      type: 'Task',
      amount: reward,
      description: 'Completed daily YouTube video task',
      status: 'completed',
    });
    await transaction.save();

    const notification = new Notification({
      user: user._id,
      message: 'Task completed! ₦300 added to your balance.',
    });
    await notification.save();

    // Emit WebSocket notification if io is available
    if (req.app.get('io')) {
      req.app.get('io').emit('notification', { message: 'Task completed! ₦300 added to your balance.' });
    }

    res.json({
      message: 'Task completed',
      balance: user.balance,
      user: {
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone || 'N/A',
        bank: user.bank || 'N/A',
        level: user.level || 1,
        balance: user.balance,
        avatar: 'https://via.placeholder.com/50',
        name: user.fullName,
        profileSet: user.profileSet,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/withdrawals', auth, async (req, res) => {
  try {
    const { methodId, amount } = req.body;
    if (!methodId || !amount || amount < 1000) {
      return res.status(400).json({ error: 'Invalid method or amount (minimum ₦1,000)' });
    }

    const user = await User.findById(req.user._id);
    if (user.balance.available < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const paymentMethod = await PaymentMethod.findOne({ _id: methodId, user: user._id });
    if (!paymentMethod) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    user.balance.available -= amount;
    user.balance.pending += amount;
    await user.save();

    const withdrawal = new Withdrawal({
      user: user._id,
      paymentMethod: methodId,
      amount,
    });
    await withdrawal.save();

    const transaction = new Transaction({
      user: user._id,
      type: 'Withdrawal',
      amount: -amount,
      description: `Withdrawal request via ${paymentMethod.type}`,
      status: 'pending',
    });
    await transaction.save();

    const notification = new Notification({
      user: user._id,
      message: `Withdrawal request of ₦${amount.toLocaleString()} submitted`,
    });
    await notification.save();

    if (req.app.get('io')) {
      req.app.get('io').emit('notification', {
        message: `Withdrawal request of ₦${amount.toLocaleString()} submitted`,
      });
    }

    res.json({ message: `Withdrawal request submitted for ₦${amount.toLocaleString()}` });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/upgrade', auth, async (req, res) => {
  try {
    const { newLevel, amount } = req.body;
    const newLevelInt = parseInt(newLevel);
    if (!newLevelInt || !amount) {
      return res.status(400).json({ error: 'Invalid level or amount' });
    }

    const user = await User.findById(req.user._id);
    if (newLevelInt <= user.level) {
      return res.status(400).json({ error: 'New level must be higher than current level' });
    }

    const expectedAmount = 15000 * Math.pow(2, newLevelInt - 1);
    if (amount !== expectedAmount) {
      return res.status(400).json({ error: 'Invalid amount for selected level' });
    }

    user.pendingPayment = { amount, level: newLevelInt, isUpgrade: true };
    await user.save();

    const upgrade = new Upgrade({
      user: user._id,
      level: newLevelInt,
      amount,
    });
    await upgrade.save();

    const transaction = new Transaction({
      user: user._id,
      type: 'Deposit',
      amount,
      description: `Upgrade to Level ${newLevelInt}`,
      status: 'pending',
    });
    await transaction.save();

    res.json({ message: `Upgrade to Level ${newLevel} initiated successfully` });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/pending-payment', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.pendingPayment) {
      return res.status(404).json({ error: 'No pending payment found' });
    }
    res.json({
      amount: user.pendingPayment.amount,
      level: user.pendingPayment.level,
      isUpgrade: user.pendingPayment.isUpgrade,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/deposits', auth, async (req, res) => {
  try {
    const { amount, type, level } = req.body;
    if (!amount || !type || !level) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await User.findById(req.user._id);
    if (!user.pendingPayment || user.pendingPayment.amount !== amount || user.pendingPayment.level !== level) {
      return res.status(400).json({ error: 'Invalid payment details' });
    }

    // Initialize Paystack payment
    const paymentData = await initPayment(user.email, amount, 'http://localhost:5000/callback');
    // Note: In production, handle Paystack callback to verify payment
    // For now, assume manual confirmation via form submission

    const transaction = await Transaction.findOne({
      user: user._id,
      amount,
      type: 'Deposit',
      status: 'pending',
    });
    if (transaction) {
      transaction.status = 'completed';
      await transaction.save();
    }

    if (type === 'registration') {
      user.status = 'active';
      user.level = level;
    } else if (type === 'upgrade') {
      const upgrade = await Upgrade.findOne({ user: user._id, level, status: 'pending' });
      if (upgrade) {
        upgrade.status = 'approved';
        await upgrade.save();
        user.level = level;
      }
    }

    user.pendingPayment = null;
    user.balance.available += amount; // For demo; adjust based on Paystack verification
    await user.save();

    const notification = new Notification({
      user: user._id,
      message: 'Payment confirmation received',
    });
    await notification.save();

    if (req.app.get('io')) {
      req.app.get('io').emit('notification', { message: 'Payment confirmation received' });
    }

    res.json({ message: 'Payment confirmation received' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/logout', auth, async (req, res) => {
  try {
    // Client-side token removal in main.js; server can invalidate token if needed
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;