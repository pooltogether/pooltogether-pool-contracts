module.exports = {
  mocha: { reporter: 'mocha-junit-reporter' },
  skipFiles: [
    "compound/ICErc20.sol",
    "test/maker/MockJoinLike.sol",
    "test/maker/MockScdMcdMigration.sol",
    "test/CErc20Mock.sol",
    "test/ERC777Mintable.sol",
    "test/ExposedBlocklock.sol",
    "test/ExposedDrawManager.sol",
    "test/ExposedUniformRandomNumber.sol",
    "test/MockERC777Recipient.sol",
    "test/MockERC777Sender.sol",
    "test/Token.sol"
  ]
};