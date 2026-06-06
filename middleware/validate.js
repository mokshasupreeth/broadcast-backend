function validateEmail(email) {

  if (!email) {
    return 'Email is required';
  }

  const emailRegex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return 'Invalid email address';
  }

  return null;
}

function validatePassword(password) {

  if (!password) {
    return 'Password is required';
  }

  if (password.length < 6) {
    return 'Password must be at least 6 characters';
  }

  return null;
}

module.exports = {
  validateEmail,
  validatePassword
};