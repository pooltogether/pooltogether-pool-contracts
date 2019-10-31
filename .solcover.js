module.exports = {
  mocha: { reporter: 'spec' },
  skipFiles: [
    "compound/ICErc20.sol",
    "test/CErc20Mock.sol",
    "test/ExposedDrawManager.sol",
    "test/ExposedUniformRandomNumber.sol",
    "test/Token.sol"
  ]
};