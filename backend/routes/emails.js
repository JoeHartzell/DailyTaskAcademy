const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const EmailLog = require('../models/EmailLog');

router.get('/', adminAuth, async (req, res) => {
  try {
    const logs = await EmailLog.find().lean();
    res.json(
      logs.map((log) => ({
        type: log.type,
        recipient: log.recipient,
        timestamp: log.createdAt,
      }))
    );
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;