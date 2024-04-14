import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [],
  build: {
    minify: true,
    assetsDir: "",
    sourcemap: false,
    outDir: resolve(__dirname, "dist"),
    lib: {
      entry: resolve(__dirname, "src/app.ts"),
      formats: ["cjs"],
      name: "Chess Master",
      fileName: "content",
    },
  },
});
