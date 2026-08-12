import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Build produksi dipasang di GitHub Pages pada sub-path nama repo
 * (https://<user>.github.io/BJM-management-system/), jadi base perlu diisi.
 * Dev server tetap di root supaya http://localhost:5180 bisa dibuka langsung.
 * Override lewat env BASE_PATH bila di-host di domain lain.
 */
export default defineConfig(({ command }) => ({
  base: process.env.BASE_PATH ?? (command === 'build' ? '/BJM-management-system/' : '/'),
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
}))
