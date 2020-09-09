// features/support/world.js
const buidler = require("@nomiclabs/buidler")
const ethers = require('ethers')
const ERC20Mintable = require('../../../build/ERC20Mintable.json')
const ERC721Mintable = require('../../../build/ERC721Mintable.json')
const { expect } = require('chai')
const { call } = require('../../helpers/call')
const { deployTestPool } = require('../../../js/deployTestPool')
const { deployContract } = require('ethereum-waffle')
require('../../helpers/chaiMatchers')

const debug = require('debug')('ptv3:PoolEnv')

const toWei = (val) => ethers.utils.parseEther('' + val)
const fromWei = (val) => ethers.utils.formatEther('' + val)

function PoolEnv() {

  this.overrides = { gasLimit: 40000000 }

  this.createPool = async function ({
    prizePeriodStart = 0,
    prizePeriodSeconds,
    exitFee,
    creditRate,
    maxExitFeeMantissa = toWei('0.5'),
    maxTimelockDuration = 1000,
    externalERC20Awards = []
  }) {
    this.wallets = await buidler.ethers.getSigners()

    debug({
      wallet1: this.wallets[0]._address,
      wallet2: this.wallets[1]._address,
      wallet3: this.wallets[2]._address
    })

    const externalAwardAddresses = []
    this.externalERC20Awards = {}
    for (var i = 0; i < externalERC20Awards.length; i++) {
      this.externalERC20Awards[externalERC20Awards[i]] = await deployContract(this.wallets[0], ERC20Mintable, [])
      externalAwardAddresses.push(this.externalERC20Awards[externalERC20Awards[i]].address)
    }

    this.externalErc721Award = await deployContract(this.wallets[0], ERC721Mintable, [])

    debug(`Fetched ${this.wallets.length} wallets`)
    debug(`Creating pool with prize period ${prizePeriodSeconds}...`)
    this.env = await deployTestPool({
      wallet: this.wallets[0],
      prizePeriodStart,
      prizePeriodSeconds,
      maxExitFeeMantissa,
      maxTimelockDuration,
      exitFee: toWei(exitFee),
      creditRate: toWei(creditRate),
      externalERC20Awards: externalAwardAddresses,
      overrides: this.overrides,
    })

    debug(`CompoundPrizePool created with address ${this.env.compoundPrizePool.address}`)
    debug(`PeriodicPrizePool created with address ${this.env.prizeStrategy.address}`)

    await this.setCurrentTime(prizePeriodStart)

    debug(`Done create Pool`)
  }

  this.setCurrentTime = async function (time) {
    let wallet = await this.wallet(0)
    let prizeStrategy = await this.prizeStrategy(wallet)
    let prizePool = await this.prizePool(wallet)
    await prizeStrategy.setCurrentTime(time, this.overrides)
    await prizePool.setCurrentTime(time, this.overrides)
    await this.env.comptroller.setCurrentTime(time, this.overrides)
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

  this.governanceToken = async function (wallet) {
    return this.env.governanceToken.connect(wallet)
  }

  this.comptroller = async function (wallet) {
    return this.env.comptroller.connect(wallet)
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
    await this.externalERC20Awards[externalAward].mint(this.env.compoundPrizePool.address, toWei(amount))
  }

  this.buyTickets = async function ({ user, tickets, referrer }) {
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

    let data = []
    if (referrer) {
      let referrerWallet = await this.wallet(referrer)
      data = ethers.utils.defaultAbiCoder.encode(['address'], [referrerWallet._address])
    }

    await prizePool.depositTo(wallet._address, amount, ticket.address, data, this.overrides)

    debug(`Bought tickets`)
  }

  this.timelockBuyTickets = async function ({ user, tickets }) {
    debug(`Buying tickets with timelocked tokens...`)
    let wallet = await this.wallet(user)

    debug('wallet is ', wallet._address)

    let ticket = await this.ticket(wallet)
    let prizePool = await this.prizePool(wallet)

    let amount = toWei('' + tickets)

    await prizePool.timelockDepositTo(wallet._address, amount, ticket.address, [], this.overrides)

    debug(`Bought tickets with timelocked tokens`)
  }

  this.timelockBuySponsorship = async function ({ user, sponsorship }) {
    debug(`Buying sponsorship with timelocked tokens...`)
    let wallet = await this.wallet(user)

    debug('wallet is ', wallet._address)

    let sponsorshipContract = await this.sponsorship(wallet)
    let prizePool = await this.prizePool(wallet)

    let amount = toWei('' + sponsorship)

    await prizePool.timelockDepositTo(wallet._address, amount, sponsorshipContract.address, [], this.overrides)

    debug(`Bought sponsorship with timelocked tokens`)
  }

  this.claimGovernanceDripTokens = async function ({ user }) {
    let wallet = await this.wallet(user)
    let comptroller = await this.comptroller(wallet)
    await comptroller.updateAndClaimDrips(
      [{
        source: this.env.prizeStrategy.address,
        measure: this.env.ticket.address
      }],
      wallet._address,
      [this.env.governanceToken.address]
    )
  }

  this.balanceDripGovernanceTokenAtRate = async function ({ dripRatePerSecond }) {
    await this.env.governanceToken.mint(this.env.comptroller.address, toWei('10000'))
    await this.env.comptroller.activateBalanceDrip(
      this.env.prizeStrategy.address,
      this.env.ticket.address,
      this.env.governanceToken.address,
      dripRatePerSecond
    )
  }

  this.volumeDripGovernanceToken = async function ({ dripAmount, periodSeconds, endTime, isReferral }) {
    debug(`volumeDripGovernanceToken minting...`)
    await this.env.governanceToken.mint(this.env.comptroller.address, toWei('10000'))
    debug(`volumeDripGovernanceToken: activating...: `, 
      this.env.prizeStrategy.address,
      this.env.ticket.address,
      this.env.governanceToken.address,
      !!isReferral,
      periodSeconds,
      toWei(dripAmount),
      endTime
    )
    await this.env.comptroller.activateVolumeDrip(
      this.env.prizeStrategy.address,
      this.env.ticket.address,
      this.env.governanceToken.address,
      !!isReferral,
      periodSeconds,
      toWei(dripAmount),
      endTime
    )
    debug(`volumeDripGovernanceToken activated!`)
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

  this.expectUserToHaveGovernanceTokens = async function ({ user, tokens }) {
    let wallet = await this.wallet(user)
    let governanceToken = await this.governanceToken(wallet)
    let amount = toWei(tokens)
    expect(await governanceToken.balanceOf(wallet._address)).to.equalish(amount, 300)
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
    let prizePool = await this.prizePool(wallet)
    let ticketInterest = await call(prizePool, 'balanceOfCredit', wallet._address, this.env.ticket.address)
    debug(`expectUserToHaveCredit ticketInterest ${ticketInterest.toString()}`)
    expect(ticketInterest).to.equalish(toWei(credit), 300)
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
    expect(await this.externalERC20Awards[externalAward].balanceOf(wallet._address)).to.equalish(toWei(amount), 300)
  }

  this.awardPrize = async function () {
    await this.awardPrizeToToken({ token: 0 })
  }

  this.awardPrizeToToken = async function ({ token }) {
    let endTime = await this._prizeStrategy.prizePeriodEndAt()

    debug(`awardPrizeToToken END TIME: ${endTime}`)

    await this.setCurrentTime(endTime)

    debug(`awardPrizeToToken Starting award with token ${token}...`)
    await this.env.prizeStrategy.startAward(this.overrides)

    let randomNumber = ethers.utils.hexlify(ethers.utils.zeroPad(ethers.BigNumber.from('' + token), 32))
    await this.env.rngService.setRandomNumber(randomNumber, this.overrides)

    debug(`awardPrizeToToken Completing award...`)
    await this.env.prizeStrategy.completeAward(this.overrides)

    debug('award completed')
  }

  this.withdrawInstantly = async function ({user, tickets}) {
    let wallet = await this.wallet(user)
    let ticket = await this.ticket(wallet)
    let prizePool = await this.prizePool(wallet)
    await prizePool.withdrawInstantlyFrom(wallet._address, toWei(tickets), ticket.address, toWei('1000'), [])
  }

  this.withdrawWithTimelock = async function ({user, tickets}) {
    let wallet = await this.wallet(user)
    let ticket = await this.ticket(wallet)
    let prizePool = await this.prizePool(wallet)
    await prizePool.withdrawWithTimelockFrom(wallet._address, toWei(tickets), ticket.address, [])
  }

  this.sweepTimelockBalances = async function ({ user }) {
    let wallet = await this.wallet(user)
    let prizePool = await this.prizePool(wallet)
    await prizePool.sweepTimelockBalances([wallet._address, wallet._address])
  }

  this.balanceOfTickets = async function ({ user }) {
    let wallet = await this.wallet(user)
    let ticket = await this.ticket(wallet)
    return fromWei(await ticket.balanceOf(wallet._address))
  }

  this.addExternalAwardERC721 = async function ({ user, tokenId }) {
    let wallet = await this.wallet(user)
    let prizePool = await this.prizePool(wallet)
    let prizeStrategy = await this.prizeStrategy(wallet)

    await this.externalErc721Award.mint(prizePool.address, tokenId)

    await prizeStrategy.addExternalErc721Award(this.externalErc721Award.address, [tokenId])
  }

  this.expectUserToHaveExternalAwardToken = async function ({ user, tokenId }) {
    let wallet = await this.wallet(user)
    expect(await this.externalErc721Award.ownerOf(tokenId)).to.equal(wallet._address)
  }

}

module.exports = {
  PoolEnv
}