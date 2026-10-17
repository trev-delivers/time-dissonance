import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      // Vercel sets this at build time once Web Analytics is on for the
      // project. Until then, leave the analytics tag out rather than ship
      // a path that 404s on every page.
      name: 'analytics-tag',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          if (process.env.VITE_VERCEL_OBSERVABILITY_BASEPATH) return html;
          return html.replace(/[ \t]*<script[^>]*%VITE_VERCEL_OBSERVABILITY_BASEPATH%[^>]*><\/script>\n?/g, '');
        },
      },
    },
  ],
})
