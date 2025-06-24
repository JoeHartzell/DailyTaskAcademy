const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const Referral = require('../models/Referral');

router.get('/', adminAuth, async (req, res) => {
  try {
    const referrals = await Referral.find().populate('referrer referredUser').lean();
    const referralStats = await Promise.all(
      referrals.reduce((acc, ref) => {
        const referrerId = ref.referrer._id.toString();
        if (!acc[referrerId]) {
          acc[referrerId] = {
            user: ref.referrer.fullName,
            referralCount: 0,
            bonusPaid: 0,
            isSuspicious: ref.suspicious,
          };
        }
        acc[referrerId].referralCount += 1;
        acc[referrerId].bonusPaid += ref.bonus;
        acc[referrerId].isSuspicious = acc[referrerId].isSuspicious || ref.suspicious;
        return acc;
      }, {})
    );
    res.json(Object.values(referralStats));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;