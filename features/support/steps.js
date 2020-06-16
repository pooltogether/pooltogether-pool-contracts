// features/support/steps.js
const { Given, When, Then } = require("cucumber");
const { expect } = require("chai");
const { ethers } = require('ethers')
const { call } = require('../../test/helpers/call')
require('../../test/helpers/chaiMatchers')

const toWei = (val) => ethers.utils.parseEther('' + val)
const fromWei = ethers.utils.formatEther

const debug = require('debug')('ptv3:cucumber:steps')

Given("a pool with a period of {int} seconds", async function(prizePeriod) {
  debug(`Creating pool`)
  await this.createPool(prizePeriod)
  debug(`Created pool`)
});

When("user {int} buys {int} tickets", async function (user, tickets) {
  await this.buyTickets(user, tickets)
})

When("user {int} buys {int} tickets at {int} seconds in", async function (user, tickets, elapsedSeconds) {
  let wallet = await this.wallet(user)
  let prizePool = await this.prizePool(wallet)
  let startTime = await prizePool.prizePeriodStartedAt()
  let buyTime = startTime.add(elapsedSeconds)
  await prizePool.setCurrentTime(buyTime)
  await this.buyTickets(user, tickets)
  await prizePool.setCurrentTime('0')
})

Then("user {int} should have {int} tickets", async function (user, tickets) {
  let wallet = await this.wallet(user)
  let ticket = await this.ticket(wallet)
  let amount = toWei(tickets)
  expect(await ticket.balanceOf(wallet._address)).to.equal(amount)
})

When("the pool accrues {int} tickets", async function (tickets) {
  await this.env.cToken.accrueCustom(toWei(tickets))
})

Then("user {int} should have {int} ticket interest", async function (user, interest) {
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

  expect(ticketInterest).to.equalish(toWei(interest), 200)
})

When("the prize is awarded", async function () {
  debug('Starting award...')
  await this._prizePool.startAward()
  debug('Completing award...')
  await this._prizePool.completeAward()
  debug('award completed')
})

When("the prize is awarded to token {int}", async function (token) {
  debug('Starting award with token ${token}...')
  await this._prizePool.startAward()
  let randomNumber = ethers.utils.hexlify(ethers.utils.padZeros(ethers.utils.bigNumberify('' + token), 32))
  await this.env.rng.setRandomNumber(randomNumber)
  debug(`Completing award...`)
  await this._prizePool.completeAward()
  debug('award completed')
})
