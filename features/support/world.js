// features/support/world.js
const { setWorldConstructor } = require("cucumber");
const buidler = require("@nomiclabs/buidler")
const { expect } = require('chai')
const { deployContracts } = require('../../js/deployContracts')

const debug = require('debug')('ptv3:cucumber:world')

function PoolBuilderWorld({ attach, parameters }) {

  this.overrides = { gasLimit: 40000000 }

  this.env = async function () {
    if (!this._env) {
      this.wallets = await buidler.ethers.getSigners()
      debug(`Fetched ${this.wallets.length} wallets`)
      debug(`Deploying contracts with ${this.wallets[0]._address}....`)
      this._env = await deployContracts(this.wallets[0])
      debug(`Deployed Contracts`)
    }
    return this._env
  }

  this.createPool = async function (prizePeriodSeconds) {
    debug(`Creating pool with prize period ${prizePeriodSeconds}`)
    let env = await this.env()

    let tx = await env.singleRandomWinnerPrizePoolBuilder.createSingleRandomWinnerPrizePool(env.cToken.address, prizePeriodSeconds, 'Ticket', 'TICK', 'Sponsorship', 'SPON', this.overrides)
    let receipt = await buidler.ethers.provider.getTransactionReceipt(tx.hash)
    let lastLog = receipt.logs[receipt.logs.length - 1]
    let singleRandomWinnerCreatedEvent = env.singleRandomWinnerPrizePoolBuilder.interface.events.SingleRandomWinnerPrizePoolCreated.decode(lastLog.data, lastLog.topics)
    this.prizePoolAddress = singleRandomWinnerCreatedEvent.prizePool
    debug(`Pool created with address ${this.prizePoolAddress}`)
  }

  this.prizePool = async function (wallet) {
    return await buidler.ethers.getContractAt('CompoundPeriodicPrizePool', this.prizePoolAddress, wallet)
  }

  this.token = async function (wallet) {
    let env = await this.env()
    return env.token.connect(wallet)
  }

  this.ticket = async function (wallet) {
    let prizePool = await this.prizePool(wallet)
    let ticketAddress = await prizePool.ticket()
    return await buidler.ethers.getContractAt('Ticket', ticketAddress, wallet)
  }

  this.wallet = async function (id) {
    await this.env()
    let wallet = this.wallets[id]
    return wallet
  }
}

setWorldConstructor(PoolBuilderWorld);