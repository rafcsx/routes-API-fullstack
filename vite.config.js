import { defineConfig } from 'vite';
import svelte from '@sveltejs/vite-plugin-svelte';
import json from '@rollup/plugin-json';

export default defineConfig({
  plugins: [svelte(), json()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
