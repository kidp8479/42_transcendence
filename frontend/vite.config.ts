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
      "@": `${import.meta.dirname}/src`,
    },
  },
  server: {
    port: 5173,
    host: true,
    // The browser only ever talks to nginx on 8080 (5173 is Vite's internal
    // dev server port, never published outside the Docker network). Without
    // this, Vite's HMR client defaults to reconnecting on 5173 directly,
    // which the browser can't reach - ERR_CONNECTION_REFUSED in the console
    // even though the app itself works fine. This tells the client to
    // reconnect through the port the browser can actually see.
    hmr: {
      clientPort: 8080,
    },
  },
});
