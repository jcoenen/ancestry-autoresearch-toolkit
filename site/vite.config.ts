import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { existsSync, statSync, createReadStream } from 'fs'
import { join } from 'path'
import type { Plugin } from 'vite'

// VAULT_ROOT env var points to the vault directory.
// Falls back to ../../ for backward compatibility when site/ is inside the vault.
const vaultRoot = process.env.VAULT_ROOT
  ? resolve(process.cwd(), process.env.VAULT_ROOT)
  : resolve(__dirname, '../..')

// Serve media files from the vault's media/ directory at /media/ path
function serveMedia(): Plugin {
  const mediaDir = resolve(vaultRoot, 'media')
  return {
    name: 'serve-media',
    configureServer(server) {
      server.middlewares.use('/media', (req, res, next) => {
        const filePath = join(mediaDir, req.url || '')
        if (existsSync(filePath) && statSync(filePath).isFile()) {
          const ext = filePath.split('.').pop()?.toLowerCase()
          const mimeTypes: Record<string, string> = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
            pdf: 'application/pdf',
          }
          res.setHeader('Content-Type', mimeTypes[ext || ''] || 'application/octet-stream')
          createReadStream(filePath).pipe(res)
        } else {
          next()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serveMedia()],
  resolve: {
    alias: {
      '@media': resolve(vaultRoot, 'media'),
    },
  },
  server: {
    fs: {
      allow: [vaultRoot, resolve(__dirname)],
    },
  },
})
