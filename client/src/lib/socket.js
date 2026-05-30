import { io } from 'socket.io-client';

let socket = null;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_ORIGIN || '/';

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token: localStorage.getItem('token') },
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}
