import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    allowedHosts: [
      'pellets.bravokilo.cloud',
      'pc.bravokilo.cloud'
    ]
  }
});