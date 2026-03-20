import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const analyze = process.env.ANALYZE === 'true'

  return {
    plugins: [
      react(),
      tailwindcss(),
      analyze &&
        visualizer({
          filename: 'dist/bundle-analysis.html',
          open: false,
          gzipSize: true,
          brotliSize: true,
        }),
    ].filter(Boolean),
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor-react'
            if (id.includes('node_modules/uplot')) return 'vendor-uplot'
            if (id.includes('node_modules/zustand')) return 'vendor-zustand'
            if (id.includes('node_modules/animejs')) return 'vendor-animejs'
            if (id.includes('node_modules/lucide-react')) return 'vendor-icons'
            if (id.includes('node_modules/@clerk/')) return 'vendor-clerk'
            return undefined
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
