// jest.config.backend.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Adjust the root if your 'api' directory is not directly under project root,
  // or if your services are elsewhere. For now, assuming 'api' is top-level.
  // roots: ['<rootDir>/api'], 
  testMatch: [
    // This pattern should correctly find the tests we created:
    // e.g., <rootDir>/api/services/__tests__/extractContent.test.ts
    '<rootDir>/api/services/__tests__/**/*.test.ts',
  ],
  // If your backend code uses path aliases (e.g., @/utils, @/services)
  // defined in a tsconfig.json for the backend, you might need to replicate them here.
  // Example:
  // moduleNameMapper: {
  //   '^@services/(.*)$': '<rootDir>/api/services/$1',
  //   '^@utils/(.*)$': '<rootDir>/api/utils/$1',
  // },
  clearMocks: true,
}; 