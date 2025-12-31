import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Default to '/' for local dev/preview. Use VITE_BASE or auto-detect GitHub Actions for GH Pages path.
const base = process.env.VITE_BASE ?? (process.env.GITHUB_ACTIONS === "true" ? "/gmct-management-system/" : "/");

export default defineConfig(() => ({
  base,
  plugins: [react()],
  build: {
    // Increase chunk warning limit to reflect app size
    chunkSizeWarningLimit: 1500,
  },
}));