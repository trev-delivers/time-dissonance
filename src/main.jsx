import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/* The design system: shared primitives, this app's theme, and the base
   behaviours every family site gets. Ahead of index.css and App's own
   styles so either can override. */
import '../ds/css/primitives.css'
import '../ds/css/themes/dissonance.css'
import '../ds/css/base.css'
import '../ds/css/components.css'
/* Design system work that has not landed upstream yet — see
   ds-proposals/README.md. Loaded after the vendored components so the fixes
   patch them, and before the app's own styles so the app can still win.
   Each of these should be deleted, not kept, once obvious ships it. */
import '../ds-proposals/fixes.css'
import '../ds-proposals/tilt.css'
import '../ds-proposals/digit.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
