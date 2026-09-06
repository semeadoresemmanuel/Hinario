import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: true, // Libera o acesso para outros dispositivos na rede local
    port: 3000,
    open: true  // Abre o navegador automaticamente
  }
});
