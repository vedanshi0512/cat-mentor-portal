import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// IMPORTANT: base must match your GitHub repo name for GitHub Pages.
// If your repo is github.com/yourname/cat-mentor-portal, base stays as below.
// If you deploy to a custom domain or root, change base to '/'.
export default defineConfig({
  plugins: [react()],
  base: '/cat-mentor-portal/',
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
})
