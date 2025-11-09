import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'fs'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [
      react(),
      // Plugin to copy Netlify files to dist
      {
        name: 'copy-netlify-files',
        writeBundle() {
          const filesToCopy = ['_redirects', '_headers', '404.html']
          
          filesToCopy.forEach(filename => {
            const sourcePath = resolve(__dirname, `public/${filename}`)
            const distPath = resolve(__dirname, `dist/${filename}`)
            
            if (existsSync(sourcePath)) {
              copyFileSync(sourcePath, distPath)
              console.log(`✅ Copied ${filename} to dist folder`)
            } else {
              console.warn(`⚠️ ${filename} file not found in public folder`)
            }
          })
        }
      }
    ],
    server: { 
      port: parseInt(env.VITE_PORT) || 5173,
      host: true
    },
    define: {
      __THEME__: JSON.stringify(env.VITE_THEME || 'heng36'),
      __DOMAIN__: JSON.stringify(env.VITE_DOMAIN || 'localhost')
    }
  }
})
