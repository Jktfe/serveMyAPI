/**
 * Jest config for a TypeScript + native-ESM project.
 *
 * - ts-jest in ESM mode transpiles .ts on the fly
 * - extensionsToTreatAsEsm tells Jest the .ts files are ES modules
 * - moduleNameMapper strips the `.js` suffix that NodeNext requires in source
 *   import paths, so Jest resolves the sibling `.ts` instead
 *
 * Run via `npm test` (which sets NODE_OPTIONS=--experimental-vm-modules).
 */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
};
