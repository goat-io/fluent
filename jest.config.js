module.exports = {
  preset: 'ts-jest',
  testRunner: 'jasmine2',
  testEnvironment: 'node',
  setupFiles: ['dotenv/config', './setup.ts'],
  // setupFilesAfterEnv: ['./fluentSetup.ts'],
  roots: ['<rootDir>/src'],
  maxWorkers: 1,
  transform: {
    '^.+\\.(tsx|ts)?$': 'ts-jest'
  },
  resolver: 'jest-node-exports-resolver',
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node']
}
