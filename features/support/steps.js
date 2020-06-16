// features/support/steps.js
const { Given, When, Then } = require("cucumber");
const { expect } = require("chai");
const { ethers } = require('ethers')

const toWei = (val) => ethers.utils.parseEther('' + val)
const fromWei = ethers.utils.formatEther

const debug = require('debug')('ptv3:cucumber:steps')

Given("a pool exists with a period of {int} seconds", async function(prizePeriod) {
  debug(`Creating pool`)
  await this.createPool(prizePeriod)
  debug(`Created pool`)
});

When("user {int} buys {int} tickets", async function (user, tickets) {
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
})

Then("user {int} should have {int} tickets", async function (user, tickets) {
  let wallet = await this.wallet(user)
  let ticket = await this.ticket(wallet)
  let amount = toWei(tickets)
  expect(await ticket.balanceOf(wallet._address)).to.equal(amount)
})