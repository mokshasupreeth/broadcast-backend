const { Resend } = require('resend');

const resend =
  new Resend(
    process.env.RESEND_API_KEY
  );

console.log(
  'RESEND EXISTS:',
  !!process.env.RESEND_API_KEY
);

console.log(
  'RESEND LENGTH:',
  process.env.RESEND_API_KEY?.length
);

exports.sendOTP =
async (email, otp) => {

  try {

    const response =
      await resend.emails.send({

        from:
          'Broadcast <onboarding@resend.dev>',

        to:
          email,

        subject:
          'Your Password Reset OTP',

        html: `
          <h2>Your OTP is ${otp}</h2>
          <p>Valid for 10 minutes.</p>
        `

      });

    console.log(
      'EMAIL SENT:',
      response
    );

    return response;

  } catch (err) {

    console.log(
      'EMAIL ERROR:',
      err
    );

    throw err;

  }

};