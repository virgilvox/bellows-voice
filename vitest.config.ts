import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    /* several tests render seconds of the voice; the assertions are the gate, not the clock */
    testTimeout: 120_000,
  },
});
