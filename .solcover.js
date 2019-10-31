module.exports = {
  mocha: { reporter: 'mocha-junit-reporter' },
  skipFiles: [
    "compound/ICErc20.sol",
    "test/CErc20Mock.sol",
    "test/ExposedDrawManager.sol",
    "test/ExposedUniformRandomNumber.sol",
    "test/Token.sol",
    "test/MockERC777Recipient.sol",
    "test/MockERC777Sender.sol"
  ]
};