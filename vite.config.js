import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Tambahkan ini

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Tambahkan ini
  ],
})