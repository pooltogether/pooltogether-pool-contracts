const BN = require('bn.js')
const {
  SALT,
  SECRET,
  SECRET_HASH,
  SUPPLY_RATE_PER_BLOCK
} = require('./constants')
const setupERC1820 = require('./setupERC1820')

const debug = require('debug')('PoolContext.js')

module.exports = function PoolContext({ web3, artifacts, accounts }) {

  let pool, token, moneyMarket, sumTree, drawManager, registry
  
  const [owner, admin, user1, user2] = accounts

  const Token = artifacts.require('Token.sol')
  const LocalMCDAwarePool = artifacts.require('LocalMCDAwarePool.sol')
  const CErc20Mock = artifacts.require('CErc20Mock.sol')
  const FixidityLib = artifacts.require('FixidityLib.sol')
  const SortitionSumTreeFactory = artifacts.require('SortitionSumTreeFactory.sol')
  const DrawManager = artifacts.require('DrawManager.sol')

  let Rewarded, Committed

  this.init = async () => {
    registry = await setupERC1820({ web3, artifacts, account: owner })

    sumTree = await SortitionSumTreeFactory.new()
    await DrawManager.link("SortitionSumTreeFactory", sumTree.address)
    drawManager = await DrawManager.new()
    await LocalMCDAwarePool.link('DrawManager', drawManager.address)
    fixidity = await FixidityLib.new({ from: admin })

    token = await this.newToken()

    moneyMarket = await CErc20Mock.new({ from: admin })
    await moneyMarket.initialize(token.address, new BN(SUPPLY_RATE_PER_BLOCK))

    await token.mint(moneyMarket.address, web3.utils.toWei('10000000', 'ether'))
    await token.mint(admin, web3.utils.toWei('100000', 'ether'))

    return {
      drawManager,
      fixidity,
      token,
      moneyMarket,
      registry
    }
  }

  this.newToken = async () => {
    const token = await Token.new({ from: admin })
    await token.initialize(owner)
    await token.mint(owner, web3.utils.toWei('100000', 'ether'))
    await token.mint(user1, web3.utils.toWei('100000', 'ether'))
    await token.mint(user2, web3.utils.toWei('100000', 'ether'))
    return token
  }

  this.balance = async () => {
    return (await pool.methods['balance()'].call()).toString()
  }

  this.depositPool = async (amount, options) => {
    if (options) {
      await token.approve(pool.address, amount, options)
      await pool.depositPool(amount, options)  
    } else {
      await token.approve(pool.address, amount)
      await pool.depositPool(amount)
    }
  }

  this.createPool = async (feeFraction = new BN('0')) => {
    await LocalMCDAwarePool.link("DrawManager", drawManager.address)
    await LocalMCDAwarePool.link("FixidityLib", fixidity.address)

    pool = await LocalMCDAwarePool.new()
    await pool.init(
      owner,
      moneyMarket.address,
      feeFraction,
      owner,
      'Prize Dai', 'pzDAI', []
    )

    await this.openNextDraw()

    return pool
  }

  this.createPoolNoInit = async (feeFraction = new BN('0')) => {
    await LocalMCDAwarePool.link("DrawManager", drawManager.address)
    await LocalMCDAwarePool.link("FixidityLib", fixidity.address)

    pool = await LocalMCDAwarePool.new()
    await pool.init(
      owner,
      moneyMarket.address,
      feeFraction,
      owner
    )

    return pool
  }

  this.rewardAndOpenNextDraw = async (options) => {
    let logs

    debug(`rewardAndOpenNextDraw(${SECRET_HASH}, ${SECRET})`)
    if (options) {
      logs = (await pool.rewardAndOpenNextDraw(SECRET_HASH, SECRET, SALT, options)).logs;
    } else {
      logs = (await pool.rewardAndOpenNextDraw(SECRET_HASH, SECRET, SALT)).logs;
    }

    debug('rewardAndOpenNextDraw: ', logs)
    Rewarded = logs[0]
    assert.equal(Rewarded.event, 'Rewarded')
    Committed = logs[1]
    assert.equal(Committed.event, 'Committed')  
  }

  this.openNextDraw = async () => {
    debug(`openNextDraw(${SECRET_HASH})`)
    let logs = (await pool.openNextDraw(SECRET_HASH)).logs
    Committed = logs[0]
  }

  this.nextDraw = async (options) => {
    let logs
    Rewarded = undefined
    Committed = undefined

    const currentDrawId = await pool.currentCommittedDrawId()

    if (currentDrawId.toString() === '0') {
      await this.openNextDraw()
    } else {
      debug(`reward(${pool.address})`)
      await moneyMarket.reward(pool.address)
      await this.rewardAndOpenNextDraw(options)
    }

    return {
      Rewarded,
      Committed
    }
  }

  this.printDrawIds = async () => {
    const rewardId = await pool.currentRewardedDrawId()
    const commitId = await pool.currentCommittedDrawId()
    const openId = await pool.currentOpenDrawId()
    console.log({ rewardId, commitId, openId })
  }
}