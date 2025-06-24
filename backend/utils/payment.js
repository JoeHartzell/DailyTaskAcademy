const axios = require('axios');

const initPayment = async (email, amount, callbackUrl) => {
  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: amount * 100, // Convert to kobo
        callback_url: callbackUrl,
      },
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` },
      }
    );
    return response.data.data;
  } catch (error) {
    throw new Error('Failed to initialize payment');
  }
};

const verifyPayment = async (reference) => {
  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` },
    });
    return response.data.data;
  } catch (error) {
    throw new Error('Failed to verify payment');
  }
};

module.exports = { initPayment, verifyPayment };