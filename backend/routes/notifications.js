const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const User = require('../models/User');
const Notification = require('../models/Notification');

router.post('/', adminAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    const users = await User.find();
    const notifications = users.map((user) => ({ user: user._id, message }));
    await Notification.insertMany(notifications);
    req.app.get('io').emit('notification', { message });
    res.json({ message: 'Notifications sent' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;