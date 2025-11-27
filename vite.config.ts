import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Only set the GH Pages base in *production*
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/gmct-management-system/" : "/",
  plugins: [react()],
}));