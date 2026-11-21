import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev`        → HTTPS on :3000, exposed on the LAN (phones need HTTPS for the camera)
// `npm run dev:local`  → plain HTTP on :3001, localhost only (localhost is already a secure context)
export default defineConfig(({ mode }) => {
  const local = mode === 'http';
  return {
    plugins: [react(), !local && basicSsl()].filter(Boolean),
    server: {
      port: local ? 3001 : 3000,
      host: !local,
    },
  };
});
