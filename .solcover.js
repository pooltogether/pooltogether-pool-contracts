const isCircle = process.env.CI === 'true'

module.exports = {
  mocha: { reporter: isCircle ? 'mocha-junit-reporter' : 'eth-gas-reporter' },
  skipFiles: [
    "compound/ICErc20.sol",
    "test/CErc20Mock.sol",
    "test/ExposedDrawManager.sol",
    "test/ExposedUniformRandomNumber.sol",
    "test/Token.sol"
  ]
};