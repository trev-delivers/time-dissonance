import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/* The design system: shared primitives, this app's theme, and the base
   behaviours every family site gets. Ahead of index.css and App's own
   styles so either can override. */
import '../ds/css/primitives.css'
import '../ds/css/themes/dissonance.css'
import '../ds/css/base.css'
import '../ds/css/components.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
