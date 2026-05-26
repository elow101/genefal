import { URL } from 'node:url'
import process from 'node:process'

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
  plugins: [vue(), process.env.NODE_ENV === 'production' ? null : vueDevTools()].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/vue')) return 'vue'
        },
      },
    },
  },

  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': proxyToPhp(),
      '/index.php': proxyToPhp(),
    },
  },
})
