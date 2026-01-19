import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { SupabaseApi } from './services/SupabaseApi'

// Initialize API based on environment
if (!window.electron) {
  console.log('Running in browser/mobile mode - Using Supabase/Web Adapter')
  // @ts-ignore
  window.api = new SupabaseApi()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
