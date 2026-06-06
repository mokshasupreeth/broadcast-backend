const axios = require('axios');

const FAST2SMS_KEY = 'uxqChZ7t6pzne1WELBUyRKJjO9VFgDGo2sHvSfkMcbiAmrI5a4uUNz0W4yMHQTF1CZdt2qfrBsLmipoa';

exports.sendSMSOTP = async (phone, otp) => {
  // Remove +91 or 91 prefix, keep only 10 digits
  const cleanPhone = phone.replace(/^\+91|^91/, '').replace(/\D/g, '');
  
  const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
    route: 'otp',
    variables_values: otp,
    numbers: cleanPhone,
  }, {
    headers: {
      authorization: FAST2SMS_KEY,
      'Content-Type': 'application/json',
    }
  });

  console.log('SMS Response:', response.data);
  return response.data;
};