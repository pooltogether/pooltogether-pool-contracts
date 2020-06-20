// features/support/world.js
const buidler = require("@nomiclabs/buidler")
const ethers = require('ethers')
const { expect } = require('chai')
const { call } = require('../../helpers/call')
const { deployTestPool } = require('../../../js/deployTestPool')
require('../../helpers/chaiMatchers')

const debug = require('debug')('ptv3:cucumber:world')

const toWei = (val) => ethers.utils.parseEther('' + val)
const fromWei = (val) => ethers.utils.formatEther('' + val)

function PoolEnv() {

  this.overrides = { gasLimit: 40000000 }

  this.createPool = async function ({ prizePeriodSeconds }) {
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

  this.buyTickets = async function ({ user, tickets }) {
    debug(`Buying tickets...`)
    let wallet = await this.wallet(user)

    debug('wallet is ', wallet._address)

    let token = await this.token(wallet)
    let prizePool = await this.prizePool(wallet)

    let amount = toWei(tickets)

    let balance = await token.balanceOf(wallet._address)
    if (balance.lt(amount)) {
      await token.mint(wallet._address, amount.mul('100'), this.overrides)
    }

    await token.approve(prizePool.address, amount, this.overrides)
    await prizePool.mintTickets(wallet._address, amount, [], this.overrides)

    debug(`Bought tickets`)
  }

  this.buyTicketsAtTime = async function ({ user, tickets, elapsed }) {
    let wallet = await this.wallet(user)
    let prizePool = await this.prizePool(wallet)
    let startTime = await prizePool.prizePeriodStartedAt()
    let buyTime = startTime.add(elapsed)
    await prizePool.setCurrentTime(buyTime, this.overrides)
    await this.buyTickets({ user, tickets })
    await prizePool.setCurrentTime('0', this.overrides)
  }

  this.expectUserToHaveTickets = async function ({ user, tickets }) {
    let wallet = await this.wallet(user)
    let ticket = await this.ticket(wallet)
    let amount = toWei(tickets)
    expect(await ticket.balanceOf(wallet._address)).to.equal(amount)
  }

  this.poolAccrues = async function ({ tickets }) {
    await this.env.cToken.accrueCustom(toWei(tickets))

    debug(`totalSupply: ${await this.env.cToken.totalSupply()}`)
    debug(`poolAccrues new underlying: ${await call(this.env.cToken, 'balanceOfUnderlying', this.env.prizePool.address)}`)
  }

  this.expectUserToHaveTicketInterest = async function ({ user, interest }) {
    let wallet = await this.wallet(user)
    let prizePool = await this.prizePool(wallet)

    let ticketShares = await prizePool.balanceOfTicketInterestShares(wallet._address)
    let interestCollateral = await prizePool.totalCollateral();
    let tickets = await this.env.ticket.balanceOf(wallet._address)
    let collateralValue = await call(prizePool, 'collateralValueOfShares', ticketShares)

    debug({
      ticketShares: fromWei(ticketShares),
      interestCollateral: fromWei(interestCollateral),
      tickets: fromWei(tickets),
      shareValue: fromWei(collateralValue)
    })

    let ticketInterest = await call(prizePool, 'balanceOfTicketInterest', wallet._address)

    expect(ticketInterest).to.equalish(toWei(interest), 300)
  }

  this.awardPrize = async function () {
    this.awardPrizeToToken({ token: 0 })
  }

  this.awardPrizeToToken = async function ({ token }) {
    let endTime = await this._prizePool.prizePeriodEndAt()

    await this._prizePool.setCurrentTime(endTime, this.overrides)

    debug(`Starting award with token ${token}...`)
    await this.env.prizeStrategy.startAward(this._prizePool.address, this.overrides)

    let randomNumber = ethers.utils.hexlify(ethers.utils.padZeros(ethers.utils.bigNumberify('' + token), 32))
    await this.env.rng.setRandomNumber(randomNumber, this.overrides)

    debug(`Completing award...`)
    await this.env.prizeStrategy.completeAward(this._prizePool.address, [], this.overrides)
    
    debug('award completed')

    await this._prizePool.setCurrentTime('0', this.overrides)
  }

}

module.exports = {
  PoolEnv
}