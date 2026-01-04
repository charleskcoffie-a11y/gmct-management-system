import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Default to '/' for local dev/preview and custom domain. Use VITE_BASE to override if needed.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig(() => ({
  base,
  plugins: [react()],
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
}));