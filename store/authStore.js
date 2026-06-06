import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'token';
const USER_KEY = 'auth_user';

export const saveAuth = async (token, user) => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  } catch (err) {
    console.log('SAVE AUTH ERROR:', err);
  }
};

export const getAuth = async () => {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const raw = await SecureStore.getItemAsync(USER_KEY);
    const user = raw ? JSON.parse(raw) : null;
    return { token, user };
  } catch (err) {
    console.log('GET AUTH ERROR:', err);
    return { token: null, user: null };
  }
};

export const clearAuth = async () => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    try {
      const { disconnectSocket } = require('../services/socket');
      disconnectSocket();
    } catch (e) {}
  } catch (err) {
    console.log('LOGOUT ERROR:', err);
  }
};

// Alias
export const logout = clearAuth;