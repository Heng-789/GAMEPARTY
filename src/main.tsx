import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

// Import theme debug utilities for development
// if (import.meta.env.DEV) {
//   import('./utils/themeDebug')
//   import('./utils/viteDebug')
//   import('./utils/themeLoadingDebug')
//   import('./utils/firebaseDebug')
//   import('./utils/themeDetectionDebug')
// }

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
