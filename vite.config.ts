import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Default to '/' so local dev/preview works. Override with VITE_BASE when deploying (e.g., GitHub Pages '/gmct-management-system/').
export default defineConfig(() => ({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  build: {
    // Increase chunk warning limit to reflect app size
    chunkSizeWarningLimit: 1500,
  },
}));