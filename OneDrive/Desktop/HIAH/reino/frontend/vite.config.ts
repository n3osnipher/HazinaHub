import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_URL || 'http://localhost:8000'

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/*.png'],
        manifest: {
          name: 'Reino Daily Task Assistant',
          short_name: 'Reino',
          description: 'AI-powered communications assistant — Hiah',
          theme_color: '#0d0d1a',
          background_color: '#0d0d1a',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/app/dashboard',
          scope: '/',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
          screenshots: [
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', form_factor: 'narrow' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 31536000 } },
            },
            {
              urlPattern: /\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: { maxEntries: 60, maxAgeSeconds: 300 },
                networkTimeoutSeconds: 10,
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/ws': {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
          secure: false,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor:    ['react', 'react-dom', 'react-router-dom'],
            zustand:   ['zustand'],
            framer:    ['framer-motion'],
            dateFns:   ['date-fns'],
          },
        },
      },
    },
  }
})
