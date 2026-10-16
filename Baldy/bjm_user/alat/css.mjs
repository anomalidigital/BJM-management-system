// Mengompilasi alat/bootstrap.scss menjadi bjm_user.Client/wwwroot/css/bootstrap.css.
//   npm install   (sekali saja, di folder alat)
//   npm run css
// Folder node_modules lain bisa dipakai lewat variabel SIKOTIS_NODE_MODULES.
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const sini = dirname(fileURLToPath(import.meta.url))
const modul = process.env.SIKOTIS_NODE_MODULES ?? join(sini, 'node_modules')
const require = createRequire(join(modul, 'x.js'))
const sass = require('sass')
const versi = require('bootstrap/package.json').version

const hasil = sass.compile(join(sini, 'bootstrap.scss'), {
  loadPaths: [modul],
  style: 'compressed',
  quietDeps: true,
  silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'mixed-decls'],
})
const tujuan = join(sini, '..', 'bjm_user.Client', 'wwwroot', 'css', 'bootstrap.css')
writeFileSync(tujuan, `/* Bootstrap ${versi} (MIT) bertema SIKOTIS. Dibuat oleh alat/css.mjs dari alat/bootstrap.scss; jangan diubah langsung. */\n${hasil.css.replace(/^﻿/, '')}\n`)
console.log(`${(hasil.css.length / 1024).toFixed(0)} KB ditulis ke ${tujuan}`)
