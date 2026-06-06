import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://broadcast-backend-mxyr.onrender.com';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// ✅ FIXED: AsyncStorage కాదు — SecureStore నుండి token చదవాలి
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.log('TOKEN ERROR:', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ======================
// AUTH
// ======================

export const registerUser = (data) => api.post('/api/auth/register', data);
export const loginUser = (data) => api.post('/api/auth/login', data);
export const getCurrentUser = () => api.get('/api/auth/me');

// ======================
// MEMBER
// ======================

export const getInboxMessages = () => api.get('/api/member/messages');
export const getMyMessages = () => api.get('/api/member/messages');
export const markRead = (id) => api.post(`/api/member/messages/${id}/read`);
export const markAsRead = (id) => api.post(`/api/member/messages/${id}/read`);
export const getMyReceipts = () => api.get('/api/member/receipts');
export const getMyGroups = () => api.get('/api/member/groups');

export const getGroupMessages = (groupId) =>
  api.get(`/api/member/groups/${groupId}/messages`);

export const sendGroupMessage = (groupId, data) =>
  api.post(`/api/member/groups/${groupId}/messages`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getDMs = () => api.get('/api/member/dm');
export const sendDM = (data) =>
  api.post('/api/member/dm', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// ======================
// CHAT / PROFILE
// ======================

export const updateProfile = (data) => api.put('/api/chat/profile', data);
export const getProfile = () => api.get('/api/chat/profile');
export const uploadAvatar = (formData) =>
  api.post('/api/chat/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getPrivateChats = () => api.get('/api/chat/chats');
export const getChatGroups = () => api.get('/api/chat/groups');

// ======================
// ADMIN
// ======================

export const getMembers = () => api.get('/api/admin/members');
export const getAllMembers = () => api.get('/api/admin/members/all');

export const sendMessage = (data) =>
  api.post('/api/admin/messages', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getSentMessages = () => api.get('/api/admin/messages');
export const deleteMessage = (id) => api.delete(`/api/admin/messages/${id}`);
export const getMessageReceipts = (id) => api.get(`/api/admin/messages/${id}/receipts`);
export const getUnreadUsers = (id) => api.get(`/api/admin/messages/${id}/unread-users`);

export const getJoinRequests = () => api.get('/api/admin/join-requests');
export const approveRequest = (id) => api.post(`/api/admin/join-requests/${id}/approve`);
export const rejectRequest = (id) => api.post(`/api/admin/join-requests/${id}/reject`);

export const getGroups = () => api.get('/api/admin/groups');
export const createGroup = (data) => api.post('/api/admin/groups', data);
export const deleteGroup = (id) => api.delete(`/api/admin/groups/${id}`);
export const addMemberToGroup = (groupId, userId) =>
  api.post(`/api/admin/groups/${groupId}/members`, { userId });
export const removeMemberFromGroup = (groupId, userId) =>
  api.delete(`/api/admin/groups/${groupId}/members/${userId}`);

export const getAnalytics = () => api.get('/api/admin/analytics');

export { BASE_URL };
export default api;