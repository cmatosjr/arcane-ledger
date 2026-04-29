import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/scryfall': {
        target: 'https://api.scryfall.com',
        changeOrigin: true,
        rewrite: path => {
          const url = new URL(path, 'http://dummy')
          const scPath = url.searchParams.get('path') || '/'
          url.searchParams.delete('path')
          const remaining = url.searchParams.toString()
          return scPath + (remaining ? '?' + remaining : '')
        },
      },
    },
  },
})
