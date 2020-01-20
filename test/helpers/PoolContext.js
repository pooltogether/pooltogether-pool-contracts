const BN = require('bn.js')
const {
  SALT,
  SECRET,
  SECRET_HASH,
  SUPPLY_RATE_PER_BLOCK,
  MAX_NEW_FIXED
} = require('./constants')
const setupERC1820 = require('./setupERC1820')

const debug = require('debug')('PoolContext.js')

module.exports = function PoolContext({ web3, artifacts, accounts }) {

  let pool, token, moneyMarket, sumTree, drawManager, registry, blocklock,  poolToken
  
  const [owner, admin, user1, user2] = accounts

  const Token = artifacts.require('Token.sol')
  const LocalMCDAwarePool = artifacts.require('LocalMCDAwarePool.sol')
  const BasePool = artifacts.require('BasePool.sol')
  const CErc20Mock = artifacts.require('CErc20Mock.sol')
  const FixidityLib = artifacts.require('FixidityLib.sol')
  const SortitionSumTreeFactory = artifacts.require('SortitionSumTreeFactory.sol')
  const DrawManager = artifacts.require('DrawManager.sol')
  const Blocklock = artifacts.require('Blocklock.sol')
  const PoolToken = artifacts.require('RecipientWhitelistPoolToken.sol')

  this.init = async () => {
    registry = await setupERC1820({ web3, artifacts, account: owner })

    sumTree = await SortitionSumTreeFactory.new()
    await DrawManager.link("SortitionSumTreeFactory", sumTree.address)
    drawManager = await DrawManager.new()
    await LocalMCDAwarePool.link('DrawManager', drawManager.address)
    fixidity = await FixidityLib.new({ from: admin })

    blocklock = await Blocklock.new()

    token = await this.newToken()

    moneyMarket = await CErc20Mock.new({ from: admin })
    await moneyMarket.initialize(token.address, new BN(SUPPLY_RATE_PER_BLOCK))

    await token.mint(moneyMarket.address, new BN(MAX_NEW_FIXED).add(new BN(web3.utils.toWei('10000000', 'ether'))).toString())
    await token.mint(admin, web3.utils.toWei('100000', 'ether'))

    return {
      drawManager,
      fixidity,
      token,
      moneyMarket,
      registry,
      blocklock
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

  this.createPool = async (feeFraction = new BN('0'), cooldownDuration = 0) => {
    pool = await this.createPoolNoOpenDraw(feeFraction, cooldownDuration)
    await this.openNextDraw()
    return pool
  }

  this.createToken = async () => {
    poolToken = await PoolToken.new()
    await poolToken.init(
      'Prize Dai', 'pzDAI', [], pool.address
    )

    assert.equal(await poolToken.pool(), pool.address)

    await pool.setPoolToken(poolToken.address)

    return poolToken
  }

  this.newPool = async () => {
    await LocalMCDAwarePool.link("DrawManager", drawManager.address)
    await LocalMCDAwarePool.link("FixidityLib", fixidity.address)
    await LocalMCDAwarePool.link('Blocklock', blocklock.address)
    
    return await LocalMCDAwarePool.new()
  }

  this.createPoolNoOpenDraw = async (feeFraction = new BN('0'), cooldownDuration = 0) => {
    pool = await this.newPool()

    // just long enough to lock then reward
    const lockDuration = 2
    
    await pool.init(
      owner,
      moneyMarket.address,
      feeFraction,
      owner,
      lockDuration,
      cooldownDuration
    )

    return pool
  }

  this.rewardAndOpenNextDraw = async (options) => {
    let logs

    debug(`rewardAndOpenNextDraw(${SECRET_HASH}, ${SECRET})`)
    await pool.lockTokens()
    if (options) {
      logs = (await pool.rewardAndOpenNextDraw(SECRET_HASH, SECRET, SALT, options)).logs;
    } else {
      logs = (await pool.rewardAndOpenNextDraw(SECRET_HASH, SECRET, SALT)).logs;
    }

    // console.log(logs.map(log => log.event))

    const [Rewarded, FeeCollected, Committed, Opened] = logs

    debug('rewardAndOpenNextDraw: ', logs)
    assert.equal(Opened.event, "Opened")
    assert.equal(Rewarded.event, 'Rewarded')
    assert.equal(Committed.event, 'Committed')  

    return { Rewarded, Committed }
  }

  this.openNextDraw = async () => {
    debug(`openNextDraw(${SECRET_HASH})`)
    let logs = (await pool.openNextDraw(SECRET_HASH)).logs

    const Committed = logs.find(log => log.event === 'Committed')
    const Opened = logs.find(log => log.event === 'Opened')

    return { Committed, Opened }
  }

  this.nextDraw = async (options) => {
    const currentDrawId = await pool.currentCommittedDrawId()

    if (currentDrawId.toString() === '0') {
      return await this.openNextDraw()
    } else {
      debug(`reward(${pool.address})`)
      await moneyMarket.reward(pool.address)
      return await this.rewardAndOpenNextDraw(options)
    }
  }

  this.printDrawIds = async () => {
    const rewardId = await pool.currentRewardedDrawId()
    const commitId = await pool.currentCommittedDrawId()
    const openId = await pool.currentOpenDrawId()
    console.log({ rewardId, commitId, openId })
  }
}