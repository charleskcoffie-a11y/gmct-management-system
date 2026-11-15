import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolvePreviewDatabase } from './services/previewDatabase';

// Default to '/' for local dev/preview and custom domain. Use VITE_BASE to override if needed.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const isPreview = env.VITE_CANADA_MISSION_PREVIEW === 'true';
  const database = resolvePreviewDatabase(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  const connectSources = ["'self'"];
  if (database.ready) connectSources.push(database.url, database.url.replace('https:', 'wss:'));
  return ({
  base,
  plugins: [react(), {
    name: 'separate-preview-database',
    transformIndexHtml() {
      if (!isPreview) return [];
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: `connect-src ${connectSources.join(' ')}; base-uri 'self'; form-action 'self'` }, injectTo: 'head-prepend' }];
    },
  }],
  build: {
    // Increase chunk warning limit to reflect app size
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          recharts: ['recharts'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  });
});
