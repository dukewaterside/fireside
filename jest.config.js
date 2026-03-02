/** Jest config for Fireside. Runs service/utility tests in Node (no React Native runtime). */
module.exports = {
  preset: 'ts-jest/presets/default',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  modulePathIgnorePatterns: ['<rootDir>/node_modules/'],
  transformIgnorePatterns: ['node_modules/(?!(@supabase)/)'],
};
