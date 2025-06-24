const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const Upgrade = require('../models/Upgrade');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

router.get('/', adminAuth, async (req, res) => {
  try {
    const upgrades = await Upgrade.find().populate('user').lean();
    res.json(
      upgrades.map((u) => ({
        _id: u._id.toString(),
        user: u.user.fullName,
        level: u.level,
        amount: u.amount,
        status: u.status,
      }))
    );
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/approve', adminAuth, async (req, res) => {
  try {
    const upgrade = await Upgrade.findById(req.params.id);
    if (!upgrade) return res.status(404).json({ error: 'Upgrade not found' });
    const user = await User.findById(upgrade.user);
    user.level = upgrade.level;
    user.pendingPayment = null;
    await user.save();
    upgrade.status = 'approved';
    await upgrade.save();

    const transaction = await Transaction.findOne({
      user: upgrade.user,
      amount: upgrade.amount,
      type: 'Deposit',
      status: 'pending',
    });
    if (transaction) {
      transaction.status = 'completed';
      await transaction.save();
    }

    const notification = new Notification({
      user: upgrade.user,
      message: `Upgrade to Level ${upgrade.level} approved`,
    });
    await notification.save();

    const totalUsers = await User.countDocuments();
    const totalEarnings = await User.aggregate([{ $group: { _id: null, total: { $sum: '$balance.available' } } }]);
    const totalTasks = await Task.aggregate([
      { $match: { 'completions.0': { $exists: true } } },
      { $group: { _id: null, total: { $sum: { $size: '$completions' } } } },
    ]);
    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });
    req.app.get('io').emit('dashboard-update', {
      totalUsers,
      totalEarnings: totalEarnings[0]?.total || 0,
      taskCompletions: totalTasks[0]?.total || 0,
      pendingWithdrawals,
    });

    res.json({ message: 'Upgrade approved' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/reject', adminAuth, async (req, res) => {
  try {
    const upgrade = await Upgrade.findById(req.params.id);
    if (!upgrade) return res.status(404).json({ error: 'Upgrade not found' });
    upgrade.status = 'rejected';
    await upgrade.save();

    const user = await User.findById(upgrade.user);
    user.pendingPayment = null;
    await user.save();

    const transaction = await Transaction.findOne({
      user: upgrade.user,
      amount: upgrade.amount,
      type: 'Deposit',
      status: 'pending',
    });
    if (transaction) {
      transaction.status = 'failed';
      await transaction.save();
    }

    const notification = new Notification({
      user: upgrade.user,
      message: `Upgrade to Level ${upgrade.level} rejected`,
    });
    await notification.save();

    const totalUsers = await User.countDocuments();
    const totalEarnings = await User.aggregate([{ $group: { _id: null, total: { $sum: '$balance.available' } } }]);
    const totalTasks = await Task.aggregate([
      { $match: { 'completions.0': { $exists: true } } },
      { $group: { _id: null, total: { $sum: { $size: '$completions' } } } },
    ]);
    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });
    req.app.get('io').emit('dashboard-update', {
      totalUsers,
      totalEarnings: totalEarnings[0]?.total || 0,
      taskCompletions: totalTasks[0]?.total || 0,
      pendingWithdrawals,
    });

    res.json({ message: 'Upgrade rejected' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;