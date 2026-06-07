console.log(
'FAST2SMS EXISTS:',
!!process.env.FAST2SMS_API_KEY
);

console.log(
'FAST2SMS LENGTH:',
process.env.FAST2SMS_API_KEY?.length
);
const axios = require('axios');

const FAST2SMS_KEY =
  process.env.FAST2SMS_API_KEY;

exports.sendSMSOTP =
async (phone, otp) => {

  const cleanPhone =
    phone
      .replace(/^\+91|^91/, '')
      .replace(/\D/g, '');

  try {

    const response =
      await axios.post(
        'https://www.fast2sms.com/dev/bulkV2',
        {
          route: 'q',

          message:
            `Your OTP is ${otp}`,

          numbers:
            cleanPhone
        },
        {
          headers: {
            authorization:
              FAST2SMS_KEY
          }
        }
      );

    console.log(
      'SMS Response:',
      response.data
    );

    return response.data;

  } catch (err) {

    console.log(
      'SMS ERROR:',
      err.response?.data ||
      err.message
    );

    throw err;
  }
};