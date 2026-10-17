import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/* The design system: primitives, this app's theme, base behaviours and
   components. Ahead of index.css and App's own styles so either can override. */
import '../ds/css/primitives.css'
import '../ds/css/themes/dissonance.css'
import '../ds/css/base.css'
import '../ds/css/components.css'
import './index.css'
import App from './App.jsx'
import { inject } from '@vercel/analytics'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Vercel sets the base path at build time once Web Analytics is on for
// the project. Without it the package falls back to /_vercel.
inject({ basePath: import.meta.env.VITE_VERCEL_OBSERVABILITY_BASEPATH })
