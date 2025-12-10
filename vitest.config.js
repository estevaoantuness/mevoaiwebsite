import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules', 'logs'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules', 'tests', 'logs', '*.config.*'],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    setupFiles: ['./tests/setup.js'],
  },
});
