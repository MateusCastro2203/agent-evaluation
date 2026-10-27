import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "laboratorio/**",
      "tarefas/**/oculto.test.ts",
    ],
  },
});
