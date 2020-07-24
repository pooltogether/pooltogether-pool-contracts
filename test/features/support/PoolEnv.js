// features/support/world.js
const buidler = require("@nomiclabs/buidler")
const ethers = require('ethers')
const ERC20Mintable = require('../../../build/ERC20Mintable.json')
const { expect } = require('chai')
const { call } = require('../../helpers/call')
const { deployTestPool } = require('../../../js/deployTestPool')
const { deployContract } = require('ethereum-waffle')
require('../../helpers/chaiMatchers')

const debug = require('debug')('ptv3:PoolEnv')

const toWei = (val) => ethers.utils.parseEther('' + val)
const fromWei = (val) => ethers.utils.formatEther('' + val)
const EMPTY_STR = []

function PoolEnv() {

  this.overrides = { gasLimit: 40000000 }

  this.createPool = async function ({ prizePeriodSeconds, exitFee, creditRate, externalAwards = [] }) {
    this.wallets = await buidler.ethers.getSigners()

    const externalAwardAddresses = []
    this.externalAwards = {}
    for (var i = 0; i < externalAwards.length; i++) {
      this.externalAwards[externalAwards[i]] = await deployContract(this.wallets[0], ERC20Mintable, [])
      externalAwardAddresses.push(this.externalAwards[externalAwards[i]].address)
    }

    debug(`Fetched ${this.wallets.length} wallets`)
    debug(`Creating pool with prize period ${prizePeriodSeconds}...`)
    this.env = await deployTestPool({
      wallet: this.wallets[0],
      prizePeriodSeconds,
      maxExitFeePercentage: toWei('0.5'),
      maxTimelockDuration: ethers.utils.bigNumberify('' + prizePeriodSeconds).mul('4'),
      exitFee: toWei(exitFee),
      creditRate: toWei(creditRate),
      overrides: this.overrides,
      externalAwards: externalAwardAddresses
    })
    debug(`CompoundPrizePool created with address ${this.env.compoundPrizePool.address}`)
    debug(`PeriodicPrizePool created with address ${this.env.prizeStrategy.address}`)
  }

  this.prizeStrategy = async function (wallet) {
    let prizeStrategy = await buidler.ethers.getContractAt('PrizeStrategyHarness', this.env.prizeStrategy.address, wallet)
    this._prizeStrategy = prizeStrategy
    return prizeStrategy
  }

  this.prizePool = async function (wallet) {
    let compoundPrizePool = await buidler.ethers.getContractAt('CompoundPrizePoolHarness', this.env.compoundPrizePool.address, wallet)
    this._prizePool = compoundPrizePool
    return compoundPrizePool
  }

  this.token = async function (wallet) {
    return this.env.token.connect(wallet)
  }

  this.ticket = async function (wallet) {
    let prizeStrategy = await this.prizeStrategy(wallet)
    let ticketAddress = await prizeStrategy.ticket()
    return await buidler.ethers.getContractAt('ControlledToken', ticketAddress, wallet)
  }

  this.sponsorship = async function (wallet) {
    let prizePool = await this.prizeStrategy(wallet)
    let sponsorshipAddress = await prizePool.sponsorship()
    return await buidler.ethers.getContractAt('ControlledToken', sponsorshipAddress, wallet)
  }

  this.wallet = async function (id) {
    let wallet = this.wallets[id]
    return wallet
  }

  this.accrueExternalAwardAmount = async function ({ externalAward, amount }) {
    await this.externalAwards[externalAward].mint(this.env.compoundPrizePool.address, toWei(amount))
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
      await token.mint(wallet._address, amount, this.overrides)
    }

    await token.approve(prizePool.address, amount, this.overrides)

    debug('Depositing...')

    await prizePool.depositTo(wallet._address, amount, ticket.address, this.overrides)

    debug(`Bought tickets`)
  }

  this.timelockBuyTickets = async function ({ user, tickets }) {
    debug(`Buying tickets with timelocked tokens...`)
    let wallet = await this.wallet(user)

    debug('wallet is ', wallet._address)

    let ticket = await this.ticket(wallet)
    let prizePool = await this.prizePool(wallet)

    let amount = toWei('' + tickets)

    await prizePool.timelockDepositTo(wallet._address, amount, ticket.address, this.overrides)

    debug(`Bought tickets with timelocked tokens`)
  }

  this.timelockBuySponsorship = async function ({ user, sponsorship }) {
    debug(`Buying sponsorship with timelocked tokens...`)
    let wallet = await this.wallet(user)

    debug('wallet is ', wallet._address)

    let sponsorshipContract = await this.sponsorship(wallet)
    let prizePool = await this.prizePool(wallet)

    let amount = toWei('' + sponsorship)

    await prizePool.timelockDepositTo(wallet._address, amount, sponsorshipContract.address, this.overrides)

    debug(`Bought sponsorship with timelocked tokens`)
  }

  this.buyTicketsAtTime = async function ({ user, tickets, elapsed }) {
    await this.atTime(elapsed, async () => {
      await this.buyTickets({ user, tickets })
    })
  }

  this.atTime = async function (elapsed, callback) {
    let wallet = await this.wallet(0)
    let prizeStrategy = await this.prizeStrategy(wallet)
    let prizePool = await this.prizePool(wallet)
    let startTime = await prizeStrategy.prizePeriodStartedAt()
    let time = startTime.add(elapsed)
    debug(`atTime(${elapsed}): startTime: ${startTime.toString()}, time: ${time.toString()}`)
    await prizeStrategy.setCurrentTime(time, this.overrides)
    await prizePool.setCurrentTime(time, this.overrides)
    await callback()
    await prizePool.setCurrentTime('0', this.overrides)
    await prizeStrategy.setCurrentTime('0', this.overrides)
  }

  this.expectUserToHaveTickets = async function ({ user, tickets }) {
    let wallet = await this.wallet(user)
    let ticket = await this.ticket(wallet)
    let amount = toWei(tickets)
    expect(await ticket.balanceOf(wallet._address)).to.equalish(amount, 300)
  }

  this.expectUserToHaveTokens = async function ({ user, tokens }) {
    let wallet = await this.wallet(user)
    let token = await this.token(wallet)
    let amount = toWei(tokens)
    expect(await token.balanceOf(wallet._address)).to.equalish(amount, 300)
  }

  this.expectUserToHaveSponsorship = async function ({ user, sponsorship }) {
    let wallet = await this.wallet(user)
    let sponsorshipContract = await this.sponsorship(wallet)
    let amount = toWei(sponsorship)
    expect(await sponsorshipContract.balanceOf(wallet._address)).to.equalish(amount, 300)
  }

  this.poolAccrues = async function ({ tickets }) {
    debug(`poolAccrues(${tickets.toString()})...`)
    await this.env.cToken.accrueCustom(toWei(tickets))

    debug(`poolAccrues cToken totalSupply: ${await this.env.cToken.totalSupply()}`)
    debug(`poolAccrues balanceOfUnderlying: ${await call(this.env.cToken, 'balanceOfUnderlying', this.env.compoundPrizePool.address)}`)
  }

  this.expectUserToHaveCredit = async function ({ user, credit }) {
    let wallet = await this.wallet(user)
    let prizeStrategy = await this.prizeStrategy(wallet)
    let ticketInterest = await call(prizeStrategy, 'balanceOfCredit', wallet._address)
    expect(ticketInterest).to.equalish(toWei(credit), 300)
  }

  this.expectUserToHaveCreditAtTime = async function ({ user, credit, elapsed }) {
    await this.atTime(elapsed, async () => {
      await this.expectUserToHaveCredit({ user, credit })
    })
  }

  this.expectUserToHaveTimelock = async function ({ user, timelock }) {
    let wallet = await this.wallet(user)
    let prizePool = await this.prizePool(wallet)
    let timelockBalance = await prizePool.timelockBalanceOf(wallet._address)
    expect(timelockBalance).to.equalish(toWei(timelock), 300)
  }

  this.expectUserTimelockAvailableAt = async function ({ user, elapsed }) {
    let wallet = await this.wallet(user)
    let prizeStrategy = await this.prizeStrategy(wallet)
    let prizePool = await this.prizePool(wallet)
    let startTime = await prizeStrategy.prizePeriodStartedAt()
    let time = startTime.add(elapsed)
    expect(await prizePool.timelockBalanceAvailableAt(wallet._address)).to.equal(time)
  }

  this.expectUserToHaveExternalAwardAmount = async function ({ user, externalAward, amount }) {
    let wallet = await this.wallet(user)
    expect(await this.externalAwards[externalAward].balanceOf(wallet._address)).to.equalish(toWei(amount), 300)
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

  this.withdrawInstantly = async function ({user, tickets}) {
    let wallet = await this.wallet(user)
    let ticket = await this.ticket(wallet)
    let prizePool = await this.prizePool(wallet)
    await prizePool.withdrawInstantlyFrom(wallet._address, toWei(tickets), ticket.address, '0', toWei('1000'))
  }

  this.withdrawInstantlyAtTime = async function ({ user, tickets, elapsed }) {
    await this.atTime(elapsed, async () => {
      await this.withdrawInstantly({ user, tickets })
    })
  }

  this.withdrawWithTimelock = async function ({user, tickets}) {
    let wallet = await this.wallet(user)
    let ticket = await this.ticket(wallet)
    let prizePool = await this.prizePool(wallet)
    await prizePool.withdrawWithTimelockFrom(wallet._address, toWei(tickets), ticket.address)
  }

  this.withdrawWithTimelockAtTime = async function ({ user, tickets, elapsed }) {
    await this.atTime(elapsed, async () => {
      await this.withdrawWithTimelock({ user, tickets })
    })
  }

  this.sweepTimelockBalances = async function ({ user }) {
    let wallet = await this.wallet(user)
    let prizePool = await this.prizePool(wallet)
    await prizePool.sweepTimelockBalances([wallet._address])
  }

  this.sweepTimelockBalancesAtTime = async function ({ user, elapsed }) {
    await this.atTime(elapsed, async () => {
      await this.sweepTimelockBalances({ user })
    })
  }

  this.balanceOfTickets = async function ({ user }) {
    let wallet = await this.wallet(user)
    let ticket = await this.ticket(wallet)
    return fromWei(await ticket.balanceOf(wallet._address))
  }

}

module.exports = {
  PoolEnv
}