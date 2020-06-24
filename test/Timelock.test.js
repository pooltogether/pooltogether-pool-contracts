const { deployContract, deployMockContract } = require('ethereum-waffle')
const TimelockHarness = require('../build/TimelockHarness.json')
const IERC20 = require('../build/IERC20.json')

const { ethers } = require('./helpers/ethers')
const { expect } = require('chai')
const buidler = require('./helpers/buidler')
const getIterable = require('./helpers/iterable')

const toWei = ethers.utils.parseEther
const toBytes = ethers.utils.toUtf8Bytes
const EMPTY_STR = toBytes('')
const now = () => Math.floor((new Date()).getTime() / 1000)

const debug = require('debug')('ptv3:Timelock.test')

let overrides = { gasLimit: 20000000 }


describe('Timelock contract', function() {
  let wallet, wallet2

  let timelock, token

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()
    debug(`using wallet ${wallet._address}`)

    debug('mocking tokens...')
    token = await deployMockContract(wallet, IERC20.abi, overrides)

    debug('deploying Harness for Timelock...')
    timelock = await deployContract(wallet, TimelockHarness, [], overrides)

    debug('preparing Timelock...')
    timelock.setTokenAddressForTest(token.address)
  })

  describe('mintTo()', () => {
    it('should mint timelock tokens to the user', async () => {
      const amount = toWei('11')
      const timestamp = 10000

      // Test mintTo
      await expect(timelock.mintTo(wallet2._address, amount, timestamp))
        .to.emit(timelock, 'CollateralTimelocked')
        .withArgs(wallet._address, wallet2._address, amount, timestamp)

      // Confirm balance
      expect(await timelock.timelockBalanceOf(wallet2._address)).to.equal(amount)
      expect(await timelock.timelockBalanceAvailableAt(wallet2._address)).to.equal(timestamp)
    })
  })

  describe('sweep()', () => {
    it('should sweep unlocked tokens from the user', async () => {
      const amounts = [toWei('10'), toWei('98765'), toWei('100'), toWei('100000000'), toWei('10101101')]
      const iterableAccounts = getIterable(await buidler.ethers.getSigners(), amounts.length)
      const accountAddresses = []
      const timestamp = now()
      let totalSupply = toWei('0')

      for await (let user of iterableAccounts()) {
        await token.mock.transfer.withArgs(user.data._address, amounts[user.index]).returns(true)

        await timelock.mintTo(user.data._address, amounts[user.index], timestamp)

        accountAddresses.push(user.data._address)
        totalSupply = totalSupply.add(amounts[user.index])
      }

      await timelock.setTokenBalanceForTest(totalSupply)

      // Confirm Total Supply
      expect(await timelock.totalSupply()).to.equal(totalSupply)

      // Test sweep
      await expect(timelock.sweep(accountAddresses))
        .to.emit(timelock, 'CollateralSwept')
        .withArgs(wallet._address, accountAddresses[0], amounts[0])

      // Confirm balances
      for await (let user of iterableAccounts()) {
        expect(await timelock.timelockBalanceOf(user.data._address)).to.equal(toWei('0')) // swept
        expect(await timelock.timelockBalanceAvailableAt(user.data._address)).to.equal(toWei('0'))
      }
    })

    it('should not sweep locked tokens from the user', async () => {
      const amounts = [toWei('10'), toWei('98765'), toWei('100'), toWei('100000000'), toWei('10101101')]
      const iterableAccounts = getIterable(await buidler.ethers.getSigners(), amounts.length)
      const accountAddresses = []
      const timestamp = now() + (60 * 1000)
      let totalSupply = toWei('0')

      for await (let user of iterableAccounts()) {
        await token.mock.transfer.withArgs(user.data._address, amounts[user.index]).returns(true)

        await timelock.mintTo(user.data._address, amounts[user.index], timestamp)

        accountAddresses.push(user.data._address)
        totalSupply = totalSupply.add(amounts[user.index])
      }

      await timelock.setTokenBalanceForTest(totalSupply)

      // Confirm Total Supply
      expect(await timelock.totalSupply()).to.equal(totalSupply)

      // Test sweep
      await timelock.sweep(accountAddresses)

      // Confirm balances
      for await (let user of iterableAccounts()) {
        expect(await timelock.timelockBalanceOf(user.data._address)).to.equal(amounts[user.index]) // not swept
        expect(await timelock.timelockBalanceAvailableAt(user.data._address)).to.equal(timestamp)
      }
    })
  })
});
