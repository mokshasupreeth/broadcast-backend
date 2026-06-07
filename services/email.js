const { google } = require('googleapis');

const oauth2Client =
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

oauth2Client.setCredentials({
  refresh_token:
    process.env.GOOGLE_REFRESH_TOKEN
});

exports.sendOTP =
async (email, otp) => {

  try {

    const accessToken =
      await oauth2Client.getAccessToken();

    const gmail =
      google.gmail({
        version: 'v1',
        auth: oauth2Client
      });

    const message = [
      `From: Broadcast <${process.env.EMAIL_USER}>`,
      `To: ${email}`,
      `Subject: Your Password Reset OTP`,
      '',
      `Your OTP is ${otp}`,
      `Valid for 10 minutes`
    ].join('\n');

    const encoded =
      Buffer
        .from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    const response =
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encoded
        }
      });

    console.log(
      'EMAIL SENT:',
      response.data.id
    );

    return response;

  } catch (err) {

    console.log(
      'EMAIL ERROR:',
      err.message
    );

    throw err;

  }

};