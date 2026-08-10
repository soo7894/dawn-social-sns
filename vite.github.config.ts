import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // The repository name is part of every GitHub Pages URL for this project.
  base: "/dawn-social-sns/",
  plugins: [react()],
  build: { outDir: "dist-github" },
});
