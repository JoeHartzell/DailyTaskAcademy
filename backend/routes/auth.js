const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Admin = require('../models/Admin');
const EmailLog = require('../models/EmailLog');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendEmail } = require('../utils/email');

router.post('/signup', async (req, res) => {
  try {
    if (req.header('Authorization')) {
      const token = req.header('Authorization').replace('Bearer ', '');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const admin = await Admin.findById(decoded.adminId);
      if (!admin) return res.status(401).json({ error: 'Admin authorization required' });
    }

    const { name: fullName, username, email, phone, password, referralCode, level, amount } = req.body;
    let referredBy = null;
    if (referralCode) {
      const refUser = await User.findOne({ referralCode });
      if (!refUser) return res.status(400).json({ error: 'Invalid referral code' });
      referredBy = refUser._id;
    }
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) return res.status(400).json({ error: 'Email or username already taken' });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const user = new User({
      fullName,
      username,
      email,
      phone,
      password,
      referredBy,
      level: level || 1,
      pendingPayment: amount ? { amount, level: level || 1, isUpgrade: false } : null,
      verificationToken,
      status: 'pending',
    });
    await user.save();

    await sendEmail(email, 'Verify Your Email', `Click to verify: http://localhost:5000/verify-email.html?token=${verificationToken}`);
    await new EmailLog({ type: 'verification', recipient: email }).save();
    res.status(201).json({
      message: amount
        ? `Registration successful! Please pay ₦${amount.toLocaleString('en-NG')} for Level ${level} to activate your account.`
        : 'Registration successful! Please verify your email.',
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;