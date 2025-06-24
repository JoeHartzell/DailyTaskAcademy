const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const Admin = require('../models/Admin');
const User = require('../models/User');
const Task = require('../models/Task');
const Withdrawal = require('../models/Withdrawal');
const EmailLog = require('../models/EmailLog');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendEmail } = require('../utils/email');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ adminId: admin._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/dashboard-stats', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalEarnings = await User.aggregate([{ $group: { _id: null, total: { $sum: '$balance.available' } } }]);
    const totalTasks = await Task.aggregate([
      { $match: { 'completions.0': { $exists: true } } },
      { $group: { _id: null, total: { $sum: { $size: '$completions' } } } },
    ]);
    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });
    res.json({
      totalUsers,
      totalEarnings: totalEarnings[0]?.total || 0,
      totalTasks: totalTasks[0]?.total || 0,
      pendingWithdrawals,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password -verificationToken').lean();
    const usersWithDetails = await Promise.all(
      users.map(async (user) => {
        const invites = await Referral.countDocuments({ referrer: user._id });
        return {
          _id: user._id.toString(),
          name: user.fullName,
          username: user.username,
          email: user.email,
          phone: user.phone || 'N/A',
          level: user.level || 1,
          status: user.status,
          invites,
          tasksCompleted: user.tasksCompleted.length,
        };
      })
    );
    res.json(usersWithDetails);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -verificationToken').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const invites = await Referral.countDocuments({ referrer: user._id });
    res.json({
      name: user.fullName,
      invites,
      tasksCompleted: user.tasksCompleted.length,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/users/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'pending', 'suspended', 'verified'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });

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

    res.json({ message: 'User status updated' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

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

    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/users/:id/reset-password', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const newPassword = crypto.randomBytes(8).toString('hex');
    user.password = newPassword;
    await user.save();
    await sendEmail(user.email, 'Password Reset', `Your new password is: ${newPassword}`);
    await new EmailLog({ type: 'password_reset', recipient: user.email }).save();
    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/users/:id/confirm-email', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.status = 'verified';
    user.verificationToken = null;
    await user.save();

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

    res.json({ message: 'Email confirmed' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/users/:id/resend-confirmation', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;
    await user.save();
    await sendEmail(user.email, 'Verify Your Email', `Click to verify: http://localhost:5000/verify-email.html?token=${verificationToken}`);
    await new EmailLog({ type: 'verification', recipient: user.email }).save();
    res.json({ message: 'Verification link resent' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/users/pending-confirmations', adminAuth, async (req, res) => {
  try {
    const users = await User.find({ status: 'pending' }).select('-password -verificationToken').lean();
    res.json(
      users.map((user) => ({
        _id: user._id.toString(),
        name: user.fullName,
        email: user.email,
        registrationDate: user.createdAt,
      }))
    );
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/admins', adminAuth, async (req, res) => {
  try {
    const admins = await Admin.find().select('-password').lean();
    res.json(
      admins.map((admin) => ({
        email: admin.email,
        contact: admin.contact || 'N/A',
      }))
    );
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/invite', adminAuth, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) return res.status(400).json({ error: 'Admin already exists' });
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const admin = new Admin({ email, password: tempPassword, contact: '' });
    await admin.save();
    await sendEmail(email, 'Admin Invitation', `Your temporary password is: ${tempPassword}`);
    await new EmailLog({ type: 'admin_invite', recipient: email }).save();
    res.json({ message: 'Invite sent' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/profile', adminAuth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-password').lean();
    res.json({
      email: admin.email,
      contact: admin.contact || 'N/A',
      avatar: admin.avatar || 'https://via.placeholder.com/50',
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/profile', adminAuth, async (req, res) => {
  try {
    const { email, password, contact } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const updates = { email, contact };
    if (password) updates.password = await bcrypt.hash(password, 10);
    const admin = await Admin.findByIdAndUpdate(req.admin._id, updates, { new: true }).select('-password');
    res.json({
      email: admin.email,
      contact: admin.contact || 'N/A',
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;