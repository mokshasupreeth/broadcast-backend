import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://broadcast-backend-mxyr.onrender.com';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    } catch (e) {
      console.log('TOKEN ERROR:', e.message);
      return config;
    }
  },
  (error) => Promise.reject(error)
);

// ─────────────────────────────────────
// AUTH
// ─────────────────────────────────────

export const login = data =>
  api.post('/api/auth/login', data);

export const loginUser = data =>
  api.post('/api/auth/login', data);

export const register = data =>
  api.post('/api/auth/register', data);

// ─────────────────────────────────────
// PROFILE
// ─────────────────────────────────────

export const getProfile = () =>
  api.get('/api/chat/profile');

export const updateProfile = data =>
  api.put('/api/chat/profile', data);

export const uploadAvatar = formData =>
  api.post('/api/chat/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// ─────────────────────────────────────
// PRIVATE CHATS
// ─────────────────────────────────────

export const getChats = () =>
  api.get('/api/chat/chats');

export const startChat = otherUserId =>
  api.post('/api/chat/chats', { otherUserId });

export const getChatMessages = chatId =>
  api.get(`/api/chat/chats/${chatId}/messages`);

export const sendPrivateMessage = (chatId, data) =>
  api.post(`/api/chat/chats/${chatId}/messages`, data);

// ─────────────────────────────────────
// GROUP CHATS
// ─────────────────────────────────────

export const getGroupChats = () =>
  api.get('/api/chat/groups');

export const getGroupMessages = groupId =>
  api.get(`/api/chat/groups/${groupId}/messages`);

export const sendGroupMessage = (groupId, data) =>
  api.post(`/api/chat/groups/${groupId}/messages`, data);

// ─────────────────────────────────────
// PINNED
// ─────────────────────────────────────

export const getPinnedChats = () =>
  api.get('/api/chat/pinned');

export const pinChat = (chatId, chatType) =>
  api.post('/api/chat/pin', { chatId, chatType });

export const unpinChat = chatId =>
  api.delete('/api/chat/pin', { data: { chatId } });

// ─────────────────────────────────────
// ARCHIVED
// ─────────────────────────────────────

export const getArchivedChats = () =>
  api.get('/api/chat/archived');

export const archiveChat = (chatId, chatType) =>
  api.post('/api/chat/archive', { chatId, chatType });

export const unarchiveChat = chatId =>
  api.delete('/api/chat/archive', { data: { chatId } });

// ─────────────────────────────────────
// USERS
// ─────────────────────────────────────

export const getChatUsers = () =>
  api.get('/api/chat/users');

// ─────────────────────────────────────
// BROADCAST MESSAGES (Inbox)
// ─────────────────────────────────────

export const getMyMessages = () =>
  api.get('/api/member/messages');

export const markRead = id =>
  api.post(`/api/member/messages/${id}/read`);

export default api;