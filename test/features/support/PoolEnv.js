// features/support/world.js
const chalk = require('chalk')
const hardhat = require("hardhat")
const ethers = require('ethers')

const { expect } = require('chai')
const { call } = require('../../helpers/call')
const { deployTestPool } = require('../../../js/deployTestPool')
const { AddressZero } = require('ethers').constants
require('../../helpers/chaiMatchers')

const debug = require('debug')('ptv3:PoolEnv')

const toWei = (val) => ethers.utils.parseEther('' + val)
const fromWei = (val) => ethers.utils.formatEther('' + val)

function PoolEnv() {

  this.overrides = { gasLimit: 9500000 }

  this.createPool = async function ({
    prizePeriodStart = 0,
    prizePeriodSeconds,
    creditLimit,
    creditRate,
    maxExitFeeMantissa = toWei('0.5'),
    maxTimelockDuration = 1000,
    externalERC20Awards = [],
    poolType
  }) {
    this.wallets = await hardhat.ethers.getSigners()

    debug({
      wallet0: this.wallets[0].address,
      wallet1: this.wallets[1].address,
      wallet2: this.wallets[2].address,
      wallet3: this.wallets[3].address,
      wallet4: this.wallets[4].address
    })

    if (!poolType) {
      poolType = 'compound'
    }

    debug(`Fetched ${this.wallets.length} wallets`)
    debug(`Creating pool with prize period ${prizePeriodSeconds}...`)
    this.env = await deployTestPool({
      wallet: this.wallets[0],
      prizePeriodStart,
      prizePeriodSeconds,
      maxExitFeeMantissa,
      maxTimelockDuration,
      creditLimit: toWei(creditLimit),
      creditRate: toWei(creditRate),
      externalERC20Awards: [],
      poolType,
      overrides: this.overrides,
    })

    const externalAwardAddresses = []
    this.externalERC20Awards = {}

    const ERC20Mintable = await hre.ethers.getContractFactory("ERC20Mintable", this.wallets[0], this.overrides)
    const ERC721Mintable = await hre.ethers.getContractFactory("ERC721Mintable", this.wallets[0], this.overrides)


    for (var i = 0; i < externalERC20Awards.length; i++) {
      this.externalERC20Awards[externalERC20Awards[i]] = await ERC20Mintable.deploy(`External ERC20 Token ${i+1}`, `ETKN${i+1}`)
      const address = this.externalERC20Awards[externalERC20Awards[i]].address;
      await this.env.prizeStrategy.addExternalErc20Award(address)
      externalAwardAddresses.push(address)
    }
    this.externalErc721Award = await ERC721Mintable.deploy()
    debug(`PrizePool created with address ${this.env.prizePool.address}`)
    debug(`PeriodicPrizePool created with address ${this.env.prizeStrategy.address}`)

    
    await this.setCurrentTime(prizePeriodStart)
    

    debug(`Done create Pool`)
  }

  this.useMultipleWinnersPrizeStrategy = async function ({ winnerCount }) {
    await this.env.prizeStrategy.setNumberOfWinners(winnerCount)
    debug(`Changed number of winners to ${winnerCount}`)
  }

  this.setCurrentTime = async function (time) {
    let wallet = await this.wallet(0)
    let prizeStrategy = await this.prizeStrategy(wallet)
    let prizePool = await this.prizePool(wallet)
    await prizeStrategy.setCurrentTime(time, this.overrides)
    await prizePool.setCurrentTime(time, this.overrides)
    await this.env.comptroller.setCurrentTime(time, this.overrides)
  }

  this.setReserveRate = async function ({rate}) {
    await this.env.reserve.setRateMantissa(toWei(rate), this.overrides)
  }

  this.prizeStrategy = async function (wallet) {
    let prizeStrategy = await hardhat.ethers.getContractAt('MultipleWinnersHarness', this.env.prizeStrategy.address, wallet)
    this._prizeStrategy = prizeStrategy
    return prizeStrategy
  }

  this.prizePool = async function (wallet) {
    let prizePool = this.env.prizePool.connect(wallet)
    this._prizePool = prizePool
    return prizePool
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
    return await hardhat.ethers.getContractAt('ControlledToken', ticketAddress, wallet)
  }

  this.sponsorship = async function (wallet) {
    let prizePool = await this.prizeStrategy(wallet)
    let sponsorshipAddress = await prizePool.sponsorship()
    return await hardhat.ethers.getContractAt('ControlledToken', sponsorshipAddress, wallet)
  }

  this.wallet = async function (id) {
    let wallet = this.wallets[id]
    return wallet
  }

  this.debugBalances = async function () {
    const yVaultAssetBalance = await this.env.token.balanceOf(this.env.yToken.address)
    const prizePoolAssetBalance = await this.env.token.balanceOf(this._prizePool.address)
    const prizePoolYTokenBalance = await this.env.yToken.balanceOf(this._prizePool.address)

    debug(`yVault Asset Balance: ${yVaultAssetBalance}...`)
    debug(`prizePool Asset Balance: ${prizePoolAssetBalance}...`)
    debug(`prizePool YToken Balance: ${prizePoolYTokenBalance}...`)
    debug('----------------------------')
  }

  this.setVaultFeeMantissa = async function ({ fee }) {
    await this.env.yToken.setVaultFeeMantissa(toWei(fee));
  }

  this.accrueExternalAwardAmount = async function ({ externalAward, amount }) {
    await this.externalERC20Awards[externalAward].mint(this.env.prizePool.address, toWei(amount))
  }

  this.buyTickets = async function ({ user, tickets, referrer }) {
    debug(`Buying tickets...`)
    let wallet = await this.wallet(user)

    debug('wallet is ', wallet.address)

    let token = await this.token(wallet)
    let ticket = await this.ticket(wallet)
    let prizePool = await this.prizePool(wallet)

    let amount = toWei(tickets)

    let balance = await token.balanceOf(wallet.address)
    if (balance.lt(amount)) {
      await token.mint(wallet.address, amount, this.overrides)
    }

    await token.approve(prizePool.address, amount, this.overrides)

    let referrerAddress = AddressZero
    if (referrer) {
      referrerAddress = (await this.wallet(referrer)).address
    }

    debug(`Depositing... (${wallet.address}, ${amount}, ${ticket.address}, ${referrerAddress})`)

    await prizePool.depositTo(wallet.address, amount, ticket.address, referrerAddress, this.overrides)

    debug(`Bought tickets`)
  }

  this.timelockBuyTickets = async function ({ user, tickets }) {
    debug(`Buying tickets with timelocked tokens...`)
    let wallet = await this.wallet(user)

    debug('wallet is ', wallet.address)

    let ticket = await this.ticket(wallet)
    let prizePool = await this.prizePool(wallet)

    let amount = toWei('' + tickets)

    await prizePool.timelockDepositTo(wallet.address, amount, ticket.address, this.overrides)

    debug(`Bought tickets with timelocked tokens`)
  }

  this.transferCompoundTokensToPrizePool = async function ({ user, tokens }) {
    let wallet = await this.wallet(user)
    let amount = toWei(tokens)
    let doubleAmount = toWei(tokens).mul(2)
    await this.env.token.mint(wallet.address, doubleAmount)

    await this.env.token.connect(wallet).approve(this.env.cToken.address, amount)
    await this.env.cToken.connect(wallet).mint(amount)
    let cTokenBalance = await this.env.cToken.balanceOf(wallet.address)
    await this.env.cToken.connect(wallet).transfer(this.env.prizePool.address, cTokenBalance);

    await this.env.token.connect(wallet).approve(this.env.cTokenYieldSource.address, amount);
    await this.env.cTokenYieldSource.connect(wallet).supplyTo(amount, this.env.prizePool.address)
  }

  this.timelockBuySponsorship = async function ({ user, sponsorship }) {
    debug(`Buying sponsorship with timelocked tokens...`)
    let wallet = await this.wallet(user)

    debug('wallet is ', wallet.address)

    let sponsorshipContract = await this.sponsorship(wallet)
    let prizePool = await this.prizePool(wallet)

    let amount = toWei('' + sponsorship)

    await prizePool.timelockDepositTo(wallet.address, amount, sponsorshipContract.address, this.overrides)

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
      wallet.address,
      [this.env.governanceToken.address]
    )
  }

  this.burnGovernanceTokensFromComptroller = async function({ amount }) {
    await this.env.governanceToken.burn(this.env.comptroller.address, toWei(amount))
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

    expect(await ticket.balanceOf(wallet.address)).to.equalish(amount, 3000)
  }

  this.expectUserToHaveTokens = async function ({ user, tokens }) {
    let wallet = await this.wallet(user)
    let token = await this.token(wallet)
    let amount = toWei(tokens)
    expect(await token.balanceOf(wallet.address)).to.equalish(amount, 300)
  }

  this.expectUserToHaveGovernanceTokens = async function ({ user, tokens }) {
    let wallet = await this.wallet(user)
    let governanceToken = await this.governanceToken(wallet)
    let amount = toWei(tokens)
    expect(await governanceToken.balanceOf(wallet.address)).to.equalish(amount, 300)
  }

  this.expectUserToHaveSponsorship = async function ({ user, sponsorship }) {
    let wallet = await this.wallet(user)
    let sponsorshipContract = await this.sponsorship(wallet)
    let amount = toWei(sponsorship)
    expect(await sponsorshipContract.balanceOf(wallet.address)).to.equalish(amount, 300)
  }

  this.poolAccrues = async function ({ tickets }) {
    debug(`poolAccrues(${tickets.toString()})...`)
    await this.env.cToken.accrueCustom(toWei(tickets))
    await this.env.token.mint(this.env.yToken.address, toWei(tickets))
  }

  this.expectPoolToHavePrize = async function ({ tickets }) {
    let ticketInterest = await call(this._prizePool, 'captureAwardBalance')
    await expect(ticketInterest).to.equalish(toWei(tickets), 4000)
  }

  this.expectUserToHaveCredit = async function ({ user, credit }) {
    let wallet = await this.wallet(user)
    let prizePool = await this.prizePool(wallet)
    let ticketInterest = await call(prizePool, 'balanceOfCredit', wallet.address, this.env.ticket.address)
    debug(`expectUserToHaveCredit ticketInterest ${ticketInterest.toString()}`)
    expect(ticketInterest).to.equalish(toWei(credit), 300)
  }

  this.expectUserToHaveTimelock = async function ({ user, timelock }) {
    let wallet = await this.wallet(user)
    let prizePool = await this.prizePool(wallet)
    let timelockBalance = await prizePool.timelockBalanceOf(wallet.address)
    expect(timelockBalance).to.equalish(toWei(timelock), 300)
  }

  this.expectUserTimelockAvailableAt = async function ({ user, elapsed }) {
    let wallet = await this.wallet(user)
    let prizeStrategy = await this.prizeStrategy(wallet)
    let prizePool = await this.prizePool(wallet)
    let startTime = await prizeStrategy.prizePeriodStartedAt()
    let time = startTime.add(elapsed)
    expect(await prizePool.timelockBalanceAvailableAt(wallet.address)).to.equal(time)
  }

  this.expectUserToHaveExternalAwardAmount = async function ({ user, externalAward, amount }) {
    let wallet = await this.wallet(user)
    expect(await this.externalERC20Awards[externalAward].balanceOf(wallet.address)).to.equalish(toWei(amount), 300)
  }

  this.startAward = async function () {
    debug(`startAward`)

    let endTime = await this._prizeStrategy.prizePeriodEndAt()

    await this.setCurrentTime(endTime)

    await this.env.prizeStrategy.startAward(this.overrides)
  }

  this.completeAward = async function ({ token }) {
    // let randomNumber = ethers.utils.hexlify(ethers.utils.zeroPad(ethers.BigNumber.from('' + token), 32))
    await this.env.rngService.setRandomNumber(token, this.overrides)

    debug(`awardPrizeToToken Completing award...`)
    await this.env.prizeStrategy.completeAward(this.overrides)

    debug('award completed')
  }

  this.expectRevertWith = async function (promise, msg) {
    await expect(promise).to.be.revertedWith(msg)
  }

  this.awardPrize = async function () {
    await this.awardPrizeToToken({ token: 0 })
  }

  this.awardPrizeToToken = async function ({ token }) {
    await this.startAward()
    await this.completeAward({ token })
  }

  this.transferTickets = async function ({ user, tickets, to }) {
    let wallet = await this.wallet(user)
    let ticket = await this.ticket(wallet)
    let toWallet = await this.wallet(to)
    await ticket.transfer(toWallet.address, toWei(tickets))
  }

  this.draw = async function ({ token }) {
    let winner = await this.env.ticket.draw(token)
    debug(`draw(${token}) = ${winner}`)
  }

  this.withdrawInstantly = async function ({user, tickets}) {
    debug(`withdrawInstantly: user ${user}, tickets: ${tickets}`)
    let wallet = await this.wallet(user)
    let ticket = await this.ticket(wallet)
    let withdrawalAmount
    if (!tickets) {
      withdrawalAmount = await ticket.balanceOf(wallet.address)
    } else {
      withdrawalAmount = toWei(tickets)
    }
    let prizePool = await this.prizePool(wallet)
    await prizePool.withdrawInstantlyFrom(wallet.address, withdrawalAmount, ticket.address, toWei('1000'))
    debug("done withdraw instantly")
  }

  this.withdrawWithTimelock = async function ({user, tickets}) {
    let wallet = await this.wallet(user)
    let ticket = await this.ticket(wallet)
    let prizePool = await this.prizePool(wallet)
    await prizePool.withdrawWithTimelockFrom(wallet.address, toWei(tickets), ticket.address, [])
  }

  this.sweepTimelockBalances = async function ({ user }) {
    let wallet = await this.wallet(user)
    let prizePool = await this.prizePool(wallet)
    await prizePool.sweepTimelockBalances([wallet.address, wallet.address])
  }

  this.balanceOfTickets = async function ({ user }) {
    let wallet = await this.wallet(user)
    let ticket = await this.ticket(wallet)
    return fromWei(await ticket.balanceOf(wallet.address))
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
    expect(await this.externalErc721Award.ownerOf(tokenId)).to.equal(wallet.address)
  }

}

module.exports = {
  PoolEnv
}