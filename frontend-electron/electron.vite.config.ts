import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      lib: {
        entry: 'electron/main.ts'
      },
      rollupOptions: {
        output: {
          entryFileNames: 'index.js'
        }
      }
    }
  },
  preload: {
    build: {
      outDir: 'out/preload',
      lib: {
        entry: 'electron/preload.ts'
      },
      rollupOptions: {
        output: {
          entryFileNames: 'index.js',
          format: 'cjs'
        }
      }
    }
  },
  renderer: {
    root: '.',
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    optimizeDeps: {
      include: ['animejs']
    },
    build: {
      outDir: 'out/renderer',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        input: 'index.html',
        output: {
          manualChunks: (id) => {
            if (!id.includes('src/')) {
              if (id.includes('uplot')) return 'vendor-uplot'
              if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react'
              if (id.includes('zustand')) return 'vendor-zustand'
              if (id.includes('animejs')) return 'vendor-animejs'
              if (id.includes('lucide')) return 'vendor-icons'
            }
          }
        }
      }
    }
  }
})
