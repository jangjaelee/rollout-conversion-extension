import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "https://localhost:8080", // 백엔드 서버
        changeOrigin: true,
        secure: false,                   // ❗ 인증서 검증 무시 (insecure)
        rewrite: (path) => path.replace(/^\/api/, "/api"), // /api는 그대로 유지
      },
    },
  },
});