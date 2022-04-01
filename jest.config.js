module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRunner: 'jasmine2',
  setupFiles: ['dotenv/config', './setup.ts'],
  roots: ['<rootDir>/src'],
  maxWorkers: 1,
  transform: {
    '^.+\\.(tsx|ts)?$': 'ts-jest'
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'd.ts'],
  transformIgnorePatterns: ['<rootDir>/node_modules/'],
  collectCoverageFrom: ['src/**/*.ts']
}
