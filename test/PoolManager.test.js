const BN = require('bn.js')
const Token = artifacts.require('Token.sol')
const Pool = artifacts.require('Pool.sol')
const PoolManager = artifacts.require('PoolManager.sol')
const CErc20Mock = artifacts.require('CErc20Mock.sol')
const FixidityLib = artifacts.require('FixidityLib.sol')
const SortitionSumTreeFactory = artifacts.require('SortitionSumTreeFactory.sol')

const zero_16 = '0000000000000000'

contract('PoolManager', (accounts) => {
  let token, moneyMarket, sumTree

  let [owner, admin, user1, user2] = accounts

  let openDuration = 1000
  let lockDuration = 2000
  let feeFraction = new BN('5' + zero_16) // equal to 0.05
  let ticketPrice = web3.utils.toWei('5', 'ether')
  let supplyRateMantissa = '100000000000000000' // 0.1 per block

  beforeEach(async () => {
    sumTree = await SortitionSumTreeFactory.new()
    fixidity = await FixidityLib.new({ from: admin })

    token = await Token.new({ from: admin })
    await token.initialize(owner)

    moneyMarket = await CErc20Mock.new({ from: admin })
    await moneyMarket.initialize(token.address, new BN(supplyRateMantissa))

    await Pool.link("FixidityLib", fixidity.address)    
    await Pool.link("SortitionSumTreeFactory", sumTree.address)    
    await PoolManager.link("FixidityLib", fixidity.address)
    await PoolManager.link("SortitionSumTreeFactory", sumTree.address)

    poolManager = await PoolManager.new({ from: admin })

    await poolManager.init(
      owner,
      moneyMarket.address,
      token.address,
      openDuration,
      lockDuration,
      ticketPrice,
      feeFraction,
      true
    )

    await token.mint(moneyMarket.address, web3.utils.toWei('10000000', 'ether'))
    await token.mint(user1, web3.utils.toWei('100000', 'ether'))
    await token.mint(user2, web3.utils.toWei('100000', 'ether'))
  })

  async function createPool() {
    let response = await poolManager.createPool()
    let poolCreatedEvent = response.receipt.logs[1]
    assert.equal(poolCreatedEvent.event, 'PoolCreated')
    return poolCreatedEvent.args[0].toString()
  }

  describe('createPool()', () => {
    it('should create a new pool', async () => {
      let address = await createPool()
      let pool = await Pool.at(address)
      assert.equal(await pool.token(), token.address)
      let poolInfo = await pool.getInfo()
      let diff = poolInfo.endBlock.sub(poolInfo.startBlock)
      assert.equal(diff.toString(), lockDuration)

      let poolManagerInfo = await poolManager.getInfo()

      assert.equal(poolManagerInfo._currentPool, address)
      assert.equal(poolManagerInfo._openDurationInBlocks.toString(), ''+ openDuration)
      assert.equal(poolManagerInfo._lockDurationInBlocks.toString(), '' + lockDuration)
      assert.equal(poolManagerInfo._ticketPrice.toString(), ticketPrice)
      assert.equal(poolManagerInfo._feeFractionFixedPoint18.toString(), feeFraction) 
      assert.equal(poolManagerInfo._poolCount.toString(), 1)
    })

    it('should allow multiple pool creation', async () => {
      let secret = '0x1234123412341234123412341234123412341234123412341234123412341234'
      let secretHash = web3.utils.soliditySha3(secret)
    
      let address = await createPool()
      let pool = await Pool.at(address)

      await pool.lock(secretHash)
      await pool.complete(secret)

      let address2 = await createPool()
      let pool2 = await Pool.at(address2)

      await pool2.lock(secretHash)
      await pool2.complete(secret)

    })
  })

  describe('setLockDuration()', () => {
    it('should update the lock duration', async () => {
      let newLockDuration = 333333
      await poolManager.setLockDuration(newLockDuration)
      assert.equal(await poolManager.lockDurationInBlocks(), newLockDuration)
    })
  })
})
