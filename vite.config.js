import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Make process.env available in client code if needed
    'process.env': {}
  },
  server: {
    port: 5173,
    host: true
  }
})
