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

  const [owner, admin, user1, user2, user3] = accounts

  const Token = artifacts.require('Token.sol')
  const MCDAwarePool = artifacts.require('MCDAwarePool.sol')
  const CErc20Mock = artifacts.require('CErc20Mock.sol')
  const FixidityLib = artifacts.require('FixidityLib.sol')
  const SortitionSumTreeFactory = artifacts.require('SortitionSumTreeFactory.sol')
  const DrawManager = artifacts.require('DrawManager.sol')
  const Blocklock = artifacts.require('Blocklock.sol')
  const PoolToken = artifacts.require('RecipientWhitelistPoolTokenDecimals.sol')

  this.init = async () => {
    this.registry = await setupERC1820({ web3, artifacts, account: owner })
    this.sumTree = await SortitionSumTreeFactory.new()
    await DrawManager.link("SortitionSumTreeFactory", this.sumTree.address)
    this.drawManager = await DrawManager.new()
    await MCDAwarePool.link('DrawManager', this.drawManager.address)
    this.fixidity = await FixidityLib.new({ from: admin })
    this.blocklock = await Blocklock.new()
    this.token = await this.newToken()
    this.moneyMarket = await CErc20Mock.new({ from: admin })
    await this.moneyMarket.initialize(this.token.address, new BN(SUPPLY_RATE_PER_BLOCK))
    await this.token.mint(this.moneyMarket.address, new BN(MAX_NEW_FIXED).add(new BN(web3.utils.toWei('10000000', 'ether'))).toString())
    await this.token.mint(admin, web3.utils.toWei('100000', 'ether'))
  }

  this.newToken = async (decimals = 18) => {
    const token = await Token.new({ from: admin })
    await token.initialize(owner, 'Token', 'TOK', decimals)
    await token.mint(owner, web3.utils.toWei('100000', 'ether'))
    await token.mint(user1, web3.utils.toWei('100000', 'ether'))
    await token.mint(user2, web3.utils.toWei('100000', 'ether'))
    await token.mint(user3, web3.utils.toWei('100000', 'ether'))
    return token
  }

  this.balance = async () => {
    return (await this.pool.methods['balance()'].call()).toString()
  }

  this.depositPool = async (amount, options) => {
    if (options) {
      await this.token.approve(this.pool.address, amount, options)
      await this.pool.depositPool(amount, options)  
    } else {
      await this.token.approve(this.pool.address, amount)
      await this.pool.depositPool(amount)
    }
  }

  this.createPool = async (feeFraction = new BN('0'), cooldownDuration = 1) => {
    this.pool = await this.createPoolNoOpenDraw(feeFraction, cooldownDuration)
    await this.openNextDraw()
    return this.pool
  }

  this.createToken = async () => {
    this.poolToken = await PoolToken.new()
    await this.poolToken.init(
      'Prize Dai', 'pzDAI', [], this.pool.address
    )

    assert.equal(await this.poolToken.pool(), this.pool.address)

    await this.pool.setPoolToken(this.poolToken.address)

    return this.poolToken
  }

  this.newPool = async () => {
    await MCDAwarePool.link("DrawManager", this.drawManager.address)
    await MCDAwarePool.link("FixidityLib", this.fixidity.address)
    await MCDAwarePool.link('Blocklock', this.blocklock.address)
    
    return await MCDAwarePool.new()
  }

  this.createPoolNoOpenDraw = async (feeFraction = new BN('0'), cooldownDuration = 1) => {
    this.pool = await this.newPool()

    // just long enough to lock then reward
    const lockDuration = 2
    
    await this.pool.init(
      owner,
      this.moneyMarket.address,
      feeFraction,
      owner,
      lockDuration,
      cooldownDuration
    )

    return this.pool
  }

  this.rewardAndOpenNextDraw = async (options) => {
    let logs

    debug(`rewardAndOpenNextDraw(${SECRET_HASH}, ${SECRET})`)
    await this.pool.lockTokens()
    if (options) {
      logs = (await this.pool.rewardAndOpenNextDraw(SECRET_HASH, SECRET, SALT, options)).logs;
    } else {
      logs = (await this.pool.rewardAndOpenNextDraw(SECRET_HASH, SECRET, SALT)).logs;
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
    let logs = (await this.pool.openNextDraw(SECRET_HASH)).logs

    const Committed = logs.find(log => log.event === 'Committed')
    const Opened = logs.find(log => log.event === 'Opened')

    return { Committed, Opened }
  }

  this.nextDraw = async (options) => {
    const currentDrawId = await this.pool.currentCommittedDrawId()

    if (currentDrawId.toString() === '0') {
      return await this.openNextDraw()
    } else {
      debug(`reward(${this.pool.address})`)
      await this.moneyMarket.reward(this.pool.address)
      return await this.rewardAndOpenNextDraw(options)
    }
  }

  this.printDrawIds = async () => {
    const rewardId = await this.pool.currentRewardedDrawId()
    const commitId = await this.pool.currentCommittedDrawId()
    const openId = await this.pool.currentOpenDrawId()
    console.log({ rewardId, commitId, openId })
  }
}