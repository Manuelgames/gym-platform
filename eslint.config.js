import astroParser from 'astro-eslint-parser';
import tseslint from 'typescript-eslint';

const noExplicitAny = {
  '@typescript-eslint/no-explicit-any': 'error',
};

export default [
  {
    ignores: ['.astro/**', 'dist/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: noExplicitAny,
  },
  {
    files: ['**/*.astro'],
    languageOptions: {
      parser: astroParser,
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: noExplicitAny,
  },
];
