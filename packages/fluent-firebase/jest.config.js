module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
   
  setupFiles: ['dotenv/config', './setup.ts'],
  roots: ['<rootDir>/src'],
  maxWorkers: 1,
  testTimeout: 300000, // 5 minutes
  transform: {
    '^.+\\.(tsx|ts)?$': 'ts-jest'
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'd.ts'],
  transformIgnorePatterns: [
    '<rootDir>/node_modules/(?!(testcontainers|@goatlab)/)'
  ],
  collectCoverageFrom: ['src/**/*.ts'],
  moduleNameMapper: {
    '^@goatlab/fluent/src/(.*)$': '<rootDir>/../fluent/src/$1',
    '^@goatlab/fluent(.*)$': '<rootDir>/../fluent/src$1'
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        skipLibCheck: true,
        types: ['jest', 'node']
      }
    }
  }
}
