const BN = require('bn.js')
const Token = artifacts.require('Token.sol')
const Lottery = artifacts.require('Lottery.sol')
const LotteryManager = artifacts.require('LotteryManager.sol')
const MoneyMarketMock = artifacts.require('MoneyMarketMock.sol')
const FixidityLib = artifacts.require('FixidityLib.sol')
const SortitionSumTreeFactory = artifacts.require('SortitionSumTreeFactory.sol')

const zero_16 = '0000000000000000'

contract('LotteryManager', (accounts) => {
  let token, moneyMarket, sumTree

  let [owner, admin, user1, user2] = accounts

  let openDuration = 1000
  let bondDuration = 2000
  let feeFraction = new BN('5' + zero_16) // equal to 0.05
  let ticketPrice = web3.utils.toWei('5', 'ether')
  let supplyRateMantissa = '100000000000000000' // 0.1 per block

  beforeEach(async () => {
    sumTree = await SortitionSumTreeFactory.new()
    fixidity = await FixidityLib.new({ from: admin })

    token = await Token.new({ from: admin })
    await token.initialize(owner)

    moneyMarket = await MoneyMarketMock.new({ from: admin })
    await moneyMarket.initialize(token.address, new BN(supplyRateMantissa))

    await Lottery.link("FixidityLib", fixidity.address)    
    await Lottery.link("SortitionSumTreeFactory", sumTree.address)    
    await LotteryManager.link("FixidityLib", fixidity.address)
    await LotteryManager.link("SortitionSumTreeFactory", sumTree.address)

    lotteryManager = await LotteryManager.new({ from: admin })

    await lotteryManager.init(
      owner,
      moneyMarket.address,
      token.address,
      openDuration,
      bondDuration,
      ticketPrice,
      feeFraction
    )

    await token.mint(moneyMarket.address, web3.utils.toWei('10000000', 'ether'))
    await token.mint(user1, web3.utils.toWei('100000', 'ether'))
    await token.mint(user2, web3.utils.toWei('100000', 'ether'))
  })

  async function createLottery() {
    let response = await lotteryManager.createLottery()
    let lotteryCreatedEvent = response.receipt.logs[1]
    assert.equal(lotteryCreatedEvent.event, 'LotteryCreated')
    return lotteryCreatedEvent.args[0].toString()
  }

  describe('createLottery()', () => {
    it('should create a new lottery', async () => {
      let address = await createLottery()
      let lottery = await Lottery.at(address)
      assert.equal(await lottery.token(), token.address)
      let lotteryInfo = await lottery.getInfo()
      let diff = lotteryInfo.endTime.sub(lotteryInfo.startTime)
      assert.equal(diff.toString(), bondDuration)

      let lotteryManagerInfo = await lotteryManager.getInfo()

      assert.equal(lotteryManagerInfo._currentLottery, address)
      assert.equal(lotteryManagerInfo._openDuration.toString(), ''+ openDuration)
      assert.equal(lotteryManagerInfo._bondDuration.toString(), '' + bondDuration)
      assert.equal(lotteryManagerInfo._ticketPrice.toString(), ticketPrice)
      assert.equal(lotteryManagerInfo._feeFractionFixedPoint18.toString(), feeFraction) 
      assert.equal(lotteryManagerInfo._lotteryCount.toString(), 1)
    })

    it('should allow multiple lottery creation', async () => {
      let secret = '0x1234123412341234123412341234123412341234123412341234123412341234'
      let secretHash = web3.utils.soliditySha3(secret)
    
      let address = await createLottery()
      let lottery = await Lottery.at(address)

      await lottery.lock(secretHash)
      await lottery.unlock(secret)

      let address2 = await createLottery()
      let lottery2 = await Lottery.at(address2)

      await lottery2.lock(secretHash)
      await lottery2.unlock(secret)

    })
  })

  describe('setBondDuration()', () => {
    it('should update the bond duration', async () => {
      let newBondDuration = 333333
      await lotteryManager.setBondDuration(newBondDuration)
      assert.equal(await lotteryManager.bondDuration(), newBondDuration)
    })
  })
})
