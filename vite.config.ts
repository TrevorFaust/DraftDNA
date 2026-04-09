import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname);
  if (mode === "development") {
    const env = loadEnv(mode, envDir, "");
    if (!env.VITE_SYNC_ADMIN_USER_ID?.trim()) {
      console.warn(
        "\n[vite] VITE_SYNC_ADMIN_USER_ID is missing from .env on disk. Save .env in the project root (next to package.json) and restart the dev server.\n"
      );
    }
  }
  return {
    envDir,
    server: {
      host: true, // Allows access from all network interfaces, including localhost
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
