import { io } from 'socket.io-client';
import { getAuth } from '../store/authStore';

const BASE_URL = 'https://broadcast-backend-mxyr.onrender.com';

let socket = null;
let currentUserId = null;

export const connectSocket = async () => {
  const { user } = await getAuth();
  if (!user) return null;

  // Already connected for same user — reuse
  if (socket?.connected && currentUserId === user.id) {
    return socket;
  }

  // Different user — disconnect old socket
  if (socket && currentUserId !== user.id) {
    socket.disconnect();
    socket = null;
    currentUserId = null;
  }

  currentUserId = user.id;

  socket = io(BASE_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('✅ Socket connected for user:', user.name);
    socket.emit('join', { userId: user.id, role: user.role });
  });

  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected');
  });

  socket.on('reconnect', () => {
    console.log('🔄 Socket reconnected');
    socket.emit('join', { userId: user.id, role: user.role });
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentUserId = null;
  }
};