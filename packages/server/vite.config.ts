import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@trivia-jam/shared/questions',
        replacement: fileURLToPath(new URL('../shared/src/questions/index.ts', import.meta.url)),
      },
      {
        find: /^@trivia-jam\/shared$/,
        replacement: fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'node',
  },
});
