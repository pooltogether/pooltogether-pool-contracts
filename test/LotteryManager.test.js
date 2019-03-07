const BN = require('bn.js')
const Token = artifacts.require('Token.sol')
const LotteryManager = artifacts.require('LotteryManager.sol')
const MoneyMarketMock = artifacts.require('MoneyMarketMock.sol')

contract('LotteryManager', (accounts) => {
  // let lottery, token, moneyMarket
  //
  // let [owner, admin, user1, user2] = accounts
  //
  // let openDuration = 0
  // let bondDuration = 0
  //
  // beforeEach(async () => {
  //   token = await Token.new({ from: admin })
  //   moneyMarket = await MoneyMarketMock.new(token.address)
  //   await token.initialize(owner)
  //
  //   await token.mint(moneyMarket.address, web3.utils.toWei('10000000', 'ether'))
  //   await token.mint(user1, web3.utils.toWei('100000', 'ether'))
  //   await token.mint(user2, web3.utils.toWei('100000', 'ether'))
  // })
  //
  // async function createLottery() {
  //   let response = await LotteryManager.new(moneyMarket.address, token.address, openDuration, bondDuration)
  //   let lotteryCreatedEvent = response.receipt.logs[0]
  //   assert.equal(lotteryCreatedEvent.event, 'LotteryCreated')
  //   return lotteryCreatedEvent.args[0].toString()
  // }
  //
  // describe('lottery with zero open and bond durations', () => {
  //   beforeEach(async () => {
  //     lottery = await Lottery.new({ from: admin })
  //     await lottery.initialize(token.address, moneyMarket.address, openDuration, bondDuration)
  //   })
  //
  //   describe('createLottery', () => {
  //     it('should create a new lottery', async () => {
  //       let id = await createLottery()
  //       assert.equal(id, '0')
  //     })
  //   })
  // })
})
