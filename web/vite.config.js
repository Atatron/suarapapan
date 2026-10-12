import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    // Semua panggilan /api diteruskan ke server ML Python.
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
});
