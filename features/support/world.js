// features/support/world.js
const { setWorldConstructor } = require("cucumber");
const buidler = require("@nomiclabs/buidler")
const ethers = require('ethers')
const { deployTestPool } = require('../../js/deployTestPool')
const {
  TASK_TEST_SETUP_TEST_ENVIRONMENT,
  TASK_BUILD_ARTIFACTS
} = require("@nomiclabs/buidler/builtin-tasks/task-names");

const debug = require('debug')('ptv3:cucumber:world')

const toWei = (val) => ethers.utils.parseEther('' + val)

function PoolBuilderWorld({ attach, parameters }) {

  this.overrides = { gasLimit: 40000000 }

  this.createPool = async function (prizePeriodSeconds) {
    // await buidler.run(TASK_BUILD_ARTIFACTS)
    this.wallets = await buidler.ethers.getSigners()
    debug(`Fetched ${this.wallets.length} wallets`)
    debug(`Creating pool with prize period ${prizePeriodSeconds}...`)
    this.env = await deployTestPool(this.wallets[0], '' + prizePeriodSeconds)
    debug(`Pool created with address ${this.env.prizePool.address}`)
  }

  this.prizePool = async function (wallet) {
    let prizePool = await buidler.ethers.getContractAt('CompoundPeriodicPrizePoolHarness', this.env.prizePool.address, wallet)
    this._prizePool = prizePool
    return prizePool
  }

  this.token = async function (wallet) {
    return this.env.token.connect(wallet)
  }

  this.ticket = async function (wallet) {
    let prizePool = await this.prizePool(wallet)
    let ticketAddress = await prizePool.ticket()
    return await buidler.ethers.getContractAt('Ticket', ticketAddress, wallet)
  }

  this.wallet = async function (id) {
    let wallet = this.wallets[id]
    return wallet
  }

  this.buyTickets = async function (user, tickets) {
    debug(`Buying tickets...`)
    let wallet = await this.wallet(user)

    debug('wallet is ', wallet._address)

    let token = await this.token(wallet)
    let prizePool = await this.prizePool(wallet)

    let amount = toWei(tickets)

    let balance = await token.balanceOf(wallet._address)
    if (balance.lt(amount)) {
      await token.mint(wallet._address, amount.mul('100'))
    }

    await token.approve(prizePool.address, amount)
    await prizePool.mintTickets(wallet._address, amount, [], this.overrides)

    debug(`Bought tickets`)
  }
}

setWorldConstructor(PoolBuilderWorld);