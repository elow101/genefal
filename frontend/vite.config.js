import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const phpBackend = 'http://127.0.0.1:8765'
const phpBackendOrigin = new URL(phpBackend).origin

function proxyToPhp() {
  return {
    target: phpBackend,
    changeOrigin: true,
    configure(proxy) {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.setHeader('Origin', phpBackendOrigin)
        proxyReq.setHeader('Referer', `${phpBackendOrigin}/`)
      })
    },
  }
}

export default defineConfig({
  // `index.php` lit `frontend/dist/index.html` depuis la racine du site.
  // Les assets buildés restent physiquement dans `frontend/dist/assets/`,
  // donc leurs URLs publiques doivent pointer vers ce dossier explicite.
  base: '/frontend/dist/',
  plugins: [vue(), vueDevTools()],

  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': proxyToPhp(),
      '/index.php': proxyToPhp(),
    },
  },

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
