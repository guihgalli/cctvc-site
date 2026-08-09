import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { instagramApiPlugin } from './src/vite-plugins/instagramApiPlugin'

export default defineConfig({
  plugins: [react(), tailwindcss(), instagramApiPlugin()],
})
