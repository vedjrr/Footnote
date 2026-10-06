import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

// Import boundaries from docs/architecture.md §5.
const boundaries = [
  {
    // core is pure TypeScript: only core itself and three libraries.
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!(zod|d3-array|yaml)$|@/core/|\\.\\.?/)',
              message: 'core may import only from core, zod, d3-array and yaml (architecture §5).',
            },
          ],
        },
      ],
    },
  },
  {
    // Relative paths that climb out of a folder are checked here.
    files: ['src/**'],
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/core',
              from: './src',
              except: ['./core'],
              message: 'core may import only from core (architecture §5).',
            },
            {
              target: './src/ui',
              from: ['./src/features', './src/adapters', './src/app'],
              message: 'ui may not import from features, adapters or app (architecture §5).',
            },
            {
              target: './src/adapters',
              from: ['./src/ui', './src/features', './src/app'],
              message: 'adapters may import only from core (architecture §5).',
            },
          ],
        },
      ],
    },
  },
  {
    // adapters take only types and ports from core.
    files: ['src/adapters/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^@/core/(?!engine/)',
              allowTypeImports: true,
              message: 'adapters may import from core only for types and ports (architecture §5).',
            },
          ],
        },
      ],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...boundaries,
  prettier,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
