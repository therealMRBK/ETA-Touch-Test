
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    // Deaktiviert HMR (Hot Module Replacement) komplett, da dies WebSockets nutzt.
    // Die Seite muss bei Code-Änderungen manuell neu geladen werden.
    hmr: false,
    allowedHosts: [
      'pellets.bravokilo.cloud',
      'pc.bravokilo.cloud',
      '.bravokilo.cloud'
    ]
  },
  // Verhindert das Injizieren des Vite-Clients, der WebSockets öffnen würde
  optimizeDeps: {
    disabled: true
  }
});
