import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // Libera o acesso para outros dispositivos na rede local
    port: 5173,
    open: true  // Abre o navegador automaticamente
  }
});
