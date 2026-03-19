import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-uplot': ['uplot'],
            'vendor-zustand': ['zustand'],
            'vendor-animejs': ['animejs'],
            'vendor-icons': ['lucide-react']
          }
        }
      }
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'animejs', 'zustand', 'uplot']
    },
    define: {
      'import.meta.env.DEMO_MODE': JSON.stringify(env.VITE_DEMO_MODE || 'false'),
      'import.meta.env.VITE_DEMO_MODE': JSON.stringify(env.VITE_DEMO_MODE || 'false')
    }
  }
})
