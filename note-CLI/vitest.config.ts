import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/types.ts',
        'src/**/index.ts',       // barrel re-exports only
        'src/tui/screens/**',    // React components — tested via extracted pure functions + E2E
        'src/tui/App.tsx',       // Root React component — tested via E2E
        'src/tui/hooks/use-global-keys.ts', // Ink useInput hook — tested via E2E
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
