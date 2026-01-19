import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  root: 'src/renderer',
  envDir: resolve(__dirname), // Point to project root for .env
  build: {
    outDir: '../../dist-web',
    emptyOutDir: true
  },
  publicDir: '../../public',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer')
    }
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          config: resolve(__dirname, 'tailwind.config.js')
        }),
        autoprefixer()
      ]
    }
  },
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  define: {
    // Define global variables if needed, though window.api is mocked in main.tsx
  }
})