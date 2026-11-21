import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
  ],
  server: {
    port: 3000,
    host: true, // Expose to local network for mobile testing
    https: true, // Required by mobile browsers (iOS Safari / Android Chrome) for getUserMedia
  },
});
