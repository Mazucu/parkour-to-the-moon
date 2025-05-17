// Mock global fetch for tests
global.fetch = jest.fn();

// No global beforeEach, each test file needs to handle its own mocks