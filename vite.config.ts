import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Relative base: the static build works at a domain root (Netlify, Vercel) or in any sub-folder.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  server: { port: 5175 },
  preview: { port: 4174 },
});
