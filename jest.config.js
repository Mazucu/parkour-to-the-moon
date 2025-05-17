module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    // Use setupFilesAfterEnv for lifecycle hooks
    setupFiles: ['<rootDir>/tests/setup.js'],
    // Detect open handles to help with timer cleanup
    detectOpenHandles: true,
    // Add a timeout for tests that might be hanging
    testTimeout: 10000
};