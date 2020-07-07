// features/support/world.js
const buidler = require("@nomiclabs/buidler")
const ethers = require('ethers')
const { expect } = require('chai')
const { call } = require('../../helpers/call')
const { deployTestPool } = require('../../../js/deployTestPool')
require('../../helpers/chaiMatchers')

const debug = require('debug')('ptv3:PoolEnv')

const toWei = (val) => ethers.utils.parseEther('' + val)
const fromWei = (val) => ethers.utils.formatEther('' + val)
const EMPTY_STR = []

function PoolEnv() {

  this.overrides = { gasLimit: 40000000 }

  this.createPool = async function ({ prizePeriodSeconds }) {
    this.wallets = await buidler.ethers.getSigners()
    debug(`Fetched ${this.wallets.length} wallets`)
    debug(`Creating pool with prize period ${prizePeriodSeconds}...`)
    this.env = await deployTestPool(this.wallets[0], '' + prizePeriodSeconds)
    debug(`CompoundPrizePool created with address ${this.env.compoundPrizePool.address}`)
    debug(`PeriodicPrizePool created with address ${this.env.prizeStrategy.address}`)
  }

  this.prizeStrategy = async function (wallet) {
    let prizeStrategy = await buidler.ethers.getContractAt('PrizeStrategyHarness', this.env.prizeStrategy.address, wallet)
    this._prizeStrategy = prizeStrategy
    return prizeStrategy
  }

  this.prizePool = async function (wallet) {
    let compoundPrizePool = await buidler.ethers.getContractAt('CompoundPrizePool', this.env.compoundPrizePool.address, wallet)
    this._prizePool = compoundPrizePool
    return compoundPrizePool
  }

  this.token = async function (wallet) {
    return this.env.token.connect(wallet)
  }

  this.ticket = async function (wallet) {
    let prizePool = await this.prizeStrategy(wallet)
    let ticketAddress = await prizePool.ticket()
    return await buidler.ethers.getContractAt('ControlledToken', ticketAddress, wallet)
  }

  this.wallet = async function (id) {
    let wallet = this.wallets[id]
    return wallet
  }

  this.buyTickets = async function ({ user, tickets }) {
    debug(`Buying tickets...`)
    let wallet = await this.wallet(user)

    debug('wallet is ', wallet._address)

    let token = await this.token(wallet)
    let ticket = await this.ticket(wallet)
    let prizePool = await this.prizePool(wallet)

    let amount = toWei(tickets)

    let balance = await token.balanceOf(wallet._address)
    if (balance.lt(amount)) {
      await token.mint(wallet._address, amount.mul('100'), this.overrides)
    }

    await token.approve(prizePool.address, amount, this.overrides)

    debug('Depositing...')

    await prizePool.depositTo(wallet._address, amount, ticket.address, this.overrides)

    debug(`Bought tickets`)
  }

  this.buyTicketsAtTime = async function ({ user, tickets, elapsed }) {
    let wallet = await this.wallet(user)
    let prizeStrategy = await this.prizeStrategy(wallet)
    let startTime = await prizeStrategy.prizePeriodStartedAt()
    let buyTime = startTime.add(elapsed)
    await prizeStrategy.setCurrentTime(buyTime, this.overrides)
    await this.buyTickets({ user, tickets })
    await prizeStrategy.setCurrentTime('0', this.overrides)
  }

  this.expectUserToHaveTickets = async function ({ user, tickets }) {
    let wallet = await this.wallet(user)
    let ticket = await this.ticket(wallet)
    let amount = toWei(tickets)
    expect(await ticket.balanceOf(wallet._address)).to.equal(amount)
  }

  this.poolAccrues = async function ({ tickets }) {
    debug(`poolAccrues(${tickets.toString()})...`)
    await this.env.cToken.accrueCustom(toWei(tickets))

    debug(`poolAccrues cToken totalSupply: ${await this.env.cToken.totalSupply()}`)
    debug(`poolAccrues balanceOfUnderlying: ${await call(this.env.cToken, 'balanceOfUnderlying', this.env.compoundPrizePool.address)}`)
  }

  this.expectUserToHaveTicketCredit = async function ({ user, interest }) {
    let wallet = await this.wallet(user)

    let prizeStrategy = await this.prizeStrategy(wallet)

    // let ticketShares = await prizeStrategy.balanceOfTicketInterestShares(wallet._address)
    // let totalCollateral = await prizeStrategy.totalCollateral();
    // let tickets = await this.env.ticket.balanceOf(wallet._address)
    // let collateralValue = await call(prizeStrategy, 'collateralValueOfShares', ticketShares)

    // debug({
    //   ticketShares: fromWei(ticketShares),
    //   totalCollateral: fromWei(totalCollateral),
    //   tickets: fromWei(tickets),
    //   collateralValue: fromWei(collateralValue)
    // })

    let ticketInterest = await call(prizeStrategy, 'balanceOfTicketInterest', wallet._address)

    expect(ticketInterest).to.equalish(toWei(interest), 300)
  }

  this.awardPrize = async function () {
    await this.awardPrizeToToken({ token: 0 })
  }

  this.awardPrizeToToken = async function ({ token }) {
    let endTime = await this._prizeStrategy.prizePeriodEndAt()

    await this._prizeStrategy.setCurrentTime(endTime, this.overrides)

    debug(`Starting award with token ${token}...`)
    await this.env.prizeStrategy.startAward(this.overrides)

    let randomNumber = ethers.utils.hexlify(ethers.utils.padZeros(ethers.utils.bigNumberify('' + token), 32))
    await this.env.rng.setRandomNumber(randomNumber, this.overrides)

    debug(`Completing award...`)
    await this.env.prizeStrategy.completeAward(this.overrides)
    
    debug('award completed')

    await this._prizeStrategy.setCurrentTime('0', this.overrides)
  }

}

module.exports = {
  PoolEnv
}