import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Use '/' for dev/preview, GH Pages base only for production build
export default defineConfig(({ command, mode }) => ({
  base: command === "build" && mode === "production" ? "/gmct-management-system/" : "/",
  plugins: [react()],
  build: {
    // Increase chunk warning limit to reflect app size
    chunkSizeWarningLimit: 1500,
  },
}));