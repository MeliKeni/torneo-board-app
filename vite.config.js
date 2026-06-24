import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/utils/**'],
      thresholds: {
        functions: 60,
        branches: 60,
        lines: 60,
      },
    },
  },
})
