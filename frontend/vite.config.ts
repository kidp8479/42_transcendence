import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import flowbiteReact from "flowbite-react/plugin/vite";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    flowbiteReact(),
  ],
  resolve: {
    alias: {
      // import.meta.dirname needs Node 20.11+; safe here since every
      // Dockerfile (frontend/backend/auth) pins Node 22. __dirname was
      // rejected instead - it's undefined under ESM and broke `tsc -b`.
      // See .github/copilot-instructions.md if this gets flagged again.
      "@": `${import.meta.dirname}/src`,
    },
  },
  server: {
    port: 5173,
    host: true,
    // Keep Vite's host-header protection enabled while admitting the browser
    // origins supported by the ingress policy.
    allowedHosts: [
      ".paris.42.school",
      "tomato.iops.dev",
      "tomato-dev.iops.dev",
    ],
    // The browser reaches Vite only through Nginx's TLS listener; 5173 is
    // internal to Docker and 8080 intentionally redirects to HTTPS.
    hmr: {
      protocol: "wss",
      clientPort: 8443,
    },
  },
});
