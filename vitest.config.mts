import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: [
      'src/**/*.test.ts',
      'data/**/*.test.ts',
      'scripts/**/*.test.ts',
      'tests/parity/**/*.test.ts',
      'tests/ingest/**/*.test.ts',
      'tests/profile/**/*.test.ts',
      'tests/model/**/*.test.ts',
      'tests/health/**/*.test.ts',
      'tests/query/**/*.test.ts',
      'tests/narrative/**/*.test.ts',
      'tests/ask/**/*.test.ts',
      'tests/eval/**/*.test.ts',
    ],
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reportsDirectory: 'coverage',
    },
  },
});
