import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Erlaubt den Zugriff von außen (horcht auf allen Netzwerk-Schnittstellen)
    host: true,
    // Verhindert "Blocked request" Fehler bei Zugriff über die Cloud-Domains
    allowedHosts: [
      'pellets.bravokilo.cloud',
      'pc.bravokilo.cloud',
      '.bravokilo.cloud' // Erlaubt alle Subdomains von bravokilo.cloud
    ]
  }
});