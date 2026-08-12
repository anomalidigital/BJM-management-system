import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * base disetel ke nama repo agar aset termuat benar di GitHub Pages
 * (https://<user>.github.io/BJM-management-system/).
 * Override dengan env BASE_PATH bila di-host di domain lain.
 */
const base = process.env.BASE_PATH ?? '/BJM-management-system/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    {
      // GitHub Pages tidak punya SPA rewrite; 404.html sebagai fallback
      // membuat deep-link (mis. /master/sopir) tetap terbuka.
      name: 'spa-404-fallback',
      closeBundle() {
        const dist = resolve(__dirname, 'dist')
        copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'))
      },
    },
  ],
  server: { port: 5180, open: false },
})
