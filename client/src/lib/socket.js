import { io } from 'socket.io-client';

let socket = null;
const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_ORIGIN || '/';
const desktopSocketOrigin = (
  import.meta.env.VITE_DESKTOP_API_ORIGIN ||
  import.meta.env.VITE_API_ORIGIN ||
  'https://noteflow-noteflow-fyggh3-aefd78-151-245-32-88.sslip.io'
).replace(/\/$/, '');
const SOCKET_URL =
  typeof window !== 'undefined' &&
  window.location.protocol === 'file:' &&
  configuredSocketUrl.startsWith('/')
    ? desktopSocketOrigin
    : configuredSocketUrl;

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
