import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/GRO_Community_Analysis/",
  plugins: [react()],
  server: {
    proxy: {
      "/tiktok-api": {
        target: "https://open.tiktokapis.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tiktok-api/, ""),
      },
    },
  },
  preview: {
    proxy: {
      "/tiktok-api": {
        target: "https://open.tiktokapis.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tiktok-api/, ""),
      },
    },
  },
});
