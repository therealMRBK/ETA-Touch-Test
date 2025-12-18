import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    hmr: false, // ABSOLUTELY NO WEBSOCKETS
    ws: false,
    watch: {
      usePolling: true,
      interval: 1000,
    },
    allowedHosts: [
      'pellets.bravokilo.cloud',
      'pc.bravokilo.cloud',
      '.bravokilo.cloud',
      'localhost'
    ]
  },
  // Ensure we are treated as a static app, no fancy dev server client injection
  appType: 'mpa', 
  optimizeDeps: {
    disabled: true
  },
  build: {
    commonjsOptions: {
      include: []
    }
  }
});