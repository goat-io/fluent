import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => {
  const isLibrary = mode === 'library'

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(isLibrary ? [dts({ rollupTypes: true })] : []),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    ...(isLibrary
      ? {
          build: {
            lib: {
              entry: resolve(__dirname, 'src/index.ts'),
              formats: ['es'],
              fileName: 'index',
            },
            rollupOptions: {
              external: ['react', 'react-dom', 'react-router-dom', 'react/jsx-runtime'],
            },
          },
        }
      : {}),
  }
})
