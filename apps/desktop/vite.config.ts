import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  // Vite options tailored for Tauri development and production builds
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // On Windows, watching for file changes on large directories may be slow
      ignored: ['**/src-tauri/**'],
    },
  },
}));
