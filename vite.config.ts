import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    // DEAKTIVIERT HMR UND WEBSOCKETS KOMPLETT
    hmr: false,
    allowedHosts: [
      'pellets.bravokilo.cloud',
      'pc.bravokilo.cloud',
      '.bravokilo.cloud'
    ]
  },
  // Verhindert das Laden des Vite-Clients im Browser, der WebSockets öffnen würde
  optimizeDeps: {
    disabled: true
  }
});