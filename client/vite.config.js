import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:4000';

  return {
    base: './',
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
        manifest: {
          name: 'NoteFlow',
          short_name: 'NoteFlow',
          description: 'Notes, meetings and collaboration',
          theme_color: '#18181b',
          background_color: '#18181b',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
      }),
    ],
    server: {
      proxy: {
        '/api': proxyTarget,
        '/socket.io': { target: proxyTarget, ws: true },
      },
    },
  };
});
