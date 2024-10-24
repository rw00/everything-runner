module.exports = {
  roots: ["<rootDir>/src"],
  testMatch: ["**/src/test/**/?(*.)+(spec|test).+(ts|tsx|js)"],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest"
  }
};
