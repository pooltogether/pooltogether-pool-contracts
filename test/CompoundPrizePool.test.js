const { deployContract } = require('ethereum-waffle')
const { deployMockContract } = require('./helpers/deployMockContract')
const CompoundPrizePoolHarness = require('../build/CompoundPrizePoolHarness.json')
const PrizePoolTokenListenerInterface = require('../build/PrizePoolTokenListenerInterface.json')
const ComptrollerInterface = require('../build/ComptrollerInterface.json')
const ControlledToken = require('../build/ControlledToken.json')
const CTokenInterface = require('../build/CTokenInterface.json')
const IERC20 = require('../build/IERC20.json')
const IERC721 = require('../build/IERC721.json')

const { ethers } = require('./helpers/ethers')
const { expect } = require('chai')
const buidler = require('./helpers/buidler')
const { call } = require('./helpers/call')
const { AddressZero } = require('ethers/constants')

const toWei = ethers.utils.parseEther
const getBlockNumber = async () => await buidler.waffle.provider.getBlockNumber()

const debug = require('debug')('ptv3:PrizePool.test')

let overrides = { gasLimit: 20000000 }

const FORWARDER = '0x5f48a3371df0F8077EC741Cc2eB31c84a4Ce332a'

const NFT_TOKEN_ID = 1

describe('CompoundPrizePool', function() {
  let wallet, wallet2

  let prizePool, erc20token, erc721token, cToken, prizeStrategy, comptroller
  let multiTokenPrizePool, multiTokenPrizeStrategy

  let poolMaxExitFee = toWei('0.5')
  let poolMaxTimelockDuration = 10000

  let ticket, sponsorship

  beforeEach(async () => {
    [wallet, wallet2] = await buidler.ethers.getSigners()
    debug(`using wallet ${wallet._address}`)

    debug('mocking tokens...')
    erc20token = await deployMockContract(wallet, IERC20.abi, overrides)
    erc721token = await deployMockContract(wallet, IERC721.abi, overrides)
    cToken = await deployMockContract(wallet, CTokenInterface.abi, overrides)
    await cToken.mock.underlying.returns(erc20token.address)

    prizeStrategy = await deployMockContract(wallet, PrizePoolTokenListenerInterface.abi, overrides)
    comptroller = await deployMockContract(wallet, ComptrollerInterface.abi, overrides)

    debug('deploying CompoundPrizePoolHarness...')
    prizePool = await deployContract(wallet, CompoundPrizePoolHarness, [], overrides)

    ticket = await deployMockContract(wallet, ControlledToken.abi, overrides)
    await ticket.mock.controller.returns(prizePool.address)
  })

  describe('with a mocked prize pool', () => {
    beforeEach(async () => {
      await prizePool.initializeAll(
        FORWARDER,
        prizeStrategy.address,
        comptroller.address,
        [ticket.address],
        poolMaxExitFee,
        poolMaxTimelockDuration,
        cToken.address
      )
      await prizePool.setCreditRateOf(ticket.address, toWei('0.01'), toWei('0.1'))
    })

    describe("beforeTokenTransfer()", () => {
      it('should not allow uncontrolled tokens to call', async () => {
        await expect(prizePool.beforeTokenTransfer(wallet._address, wallet2._address, toWei('1')))
          .to.be.revertedWith('PrizePool/unknown-token')
      })

      it('should allow controlled tokens to call', async () => {
        await ticket.mock.balanceOf.withArgs(wallet._address).returns(toWei('10'))
        await ticket.mock.balanceOf.withArgs(wallet2._address).returns(toWei('10'))

        await prizeStrategy.mock.beforeTokenTransfer.withArgs(wallet._address, wallet2._address, toWei('1'), ticket.address).returns()
        await comptroller.mock.beforeTokenTransfer.withArgs(wallet._address, wallet2._address, toWei('1'), ticket.address).returns()
        await ticket.call(prizePool, 'beforeTokenTransfer', wallet._address, wallet2._address, toWei('1'))
      })
    })

    describe('initialize()', () => {
      it('should set all the vars', async () => {
        expect(await prizePool.cToken()).to.equal(cToken.address)
        expect(await prizePool.token()).to.equal(erc20token.address)
      })
    })

    describe('depositTo()', () => {
      it('should mint timelock tokens to the user', async () => {
        const amount = toWei('11')

        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet2._address).returns(amount)

        await erc20token.mock.transferFrom.withArgs(wallet._address, prizePool.address, amount).returns(true)
        await erc20token.mock.approve.withArgs(cToken.address, amount).returns(true)
        await cToken.mock.mint.withArgs(amount).returns('0')
        await comptroller.mock.beforeTokenMint.withArgs(wallet2._address, amount, ticket.address, AddressZero).returns()
        await prizeStrategy.mock.beforeTokenMint.withArgs(wallet2._address, amount, ticket.address, AddressZero).returns()
        await ticket.mock.controllerMint.withArgs(wallet2._address, amount).returns()

        // Test depositTo
        await expect(prizePool.depositTo(wallet2._address, amount, ticket.address, AddressZero))
          .to.emit(prizePool, 'Deposited')
          .withArgs(wallet._address, wallet2._address, ticket.address, amount)

      })

      it('should revert on Compound failure', async () => {
        const amount = toWei('11')

        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns('0')
        await ticket.mock.balanceOf.withArgs(wallet._address).returns(amount)

        await erc20token.mock.transferFrom.withArgs(wallet._address, prizePool.address, amount).returns(true)
        await erc20token.mock.approve.withArgs(cToken.address, amount).returns(true)
        await cToken.mock.mint.withArgs(amount).returns('1')
        await comptroller.mock.beforeTokenMint.withArgs(wallet2._address, amount, ticket.address, AddressZero).returns()
        await prizeStrategy.mock.beforeTokenMint.withArgs(wallet2._address, amount, ticket.address, AddressZero).returns()
        await ticket.mock.controllerMint.withArgs(wallet2._address, amount).returns()

        // Test depositTo
        await expect(prizePool.depositTo(wallet2._address, amount, ticket.address, AddressZero))
          .to.be.revertedWith("CompoundPrizePool/mint-failed")
        
      })
    })

    describe('awardBalance()', () => { 
      it('should return the yield less the total token supply', async () => {
        await comptroller.mock.reserveRateMantissa.returns(0)
        await ticket.mock.totalSupply.returns(toWei('100'))
        await cToken.mock.balanceOfUnderlying.returns(toWei('110'))
        expect(await call(prizePool, 'awardBalance')).to.equal(toWei('10'))
      })

      it('should take the reserve fee into account', async () => {
        await comptroller.mock.reserveRateMantissa.returns(toWei('0.5'))
        await ticket.mock.totalSupply.returns(toWei('100'))
        await cToken.mock.balanceOfUnderlying.returns(toWei('110'))
        expect(await call(prizePool, 'awardBalance')).to.equal(toWei('5'))
      })
    })

    describe('withdrawInstantlyFrom()', () => {
      it('should revert on Compound error', async () => {
        let amount = toWei('10')

        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet._address).returns(amount)

        await ticket.mock.controllerBurnFrom.withArgs(wallet._address, wallet._address, amount).returns()
        await cToken.mock.redeemUnderlying.withArgs(toWei('9')).returns('1')
        await erc20token.mock.transfer.withArgs(wallet._address, toWei('10')).returns(true)
        await comptroller.mock.beforeTokenTransfer.withArgs(wallet._address, AddressZero, amount, ticket.address).returns()

        await expect(prizePool.withdrawInstantlyFrom(wallet._address, amount, ticket.address, toWei('1')))
          .to.be.revertedWith('CompoundPrizePool/redeem-failed')
      })

      it('should allow a user to withdraw instantly', async () => {
        let amount = toWei('10')

        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns('0')
        await ticket.mock.balanceOf.withArgs(wallet._address).returns(toWei('10'))

        await ticket.mock.controllerBurnFrom.withArgs(wallet._address, wallet._address, amount).returns()
        await cToken.mock.redeemUnderlying.withArgs(toWei('9')).returns('0')
        await erc20token.mock.transfer.withArgs(wallet._address, toWei('9')).returns(true)
        await comptroller.mock.beforeTokenTransfer.withArgs(wallet._address, AddressZero, amount, ticket.address).returns()

        await expect(prizePool.withdrawInstantlyFrom(wallet._address, amount, ticket.address, toWei('1')))
          .to.emit(prizePool, 'InstantWithdrawal')
          .withArgs(wallet._address, wallet._address, ticket.address, amount, toWei('1'))
      })

      it('should allow a user to set a maximum exit fee', async () => {
        let amount = toWei('10')
        let fee = toWei('1')

        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet._address).returns(toWei('10'))

        await ticket.mock.controllerBurnFrom.withArgs(wallet2._address, wallet._address, amount).returns()
        await cToken.mock.redeemUnderlying.withArgs(amount.sub(fee)).returns('0')
        await erc20token.mock.transfer.withArgs(wallet._address, amount.sub(fee)).returns(true)
        await comptroller.mock.beforeTokenTransfer.withArgs(wallet._address, AddressZero, amount, ticket.address).returns()

        await expect(prizePool.connect(wallet2).withdrawInstantlyFrom(wallet._address, amount, ticket.address, fee))
          .to.emit(prizePool, 'InstantWithdrawal')
          .withArgs(wallet2._address, wallet._address, ticket.address, amount, fee)
      })

      it('should revert if fee exceeds the user maximum', async () => {
        let amount = toWei('10')

        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet._address).returns(amount)

        await ticket.mock.controllerBurnFrom.withArgs(wallet._address, wallet._address, amount).returns()
        await cToken.mock.redeemUnderlying.withArgs(toWei('9')).returns('0')
        await erc20token.mock.transfer.withArgs(wallet._address, toWei('10')).returns(true)
        await comptroller.mock.beforeTokenTransfer.withArgs(wallet._address, AddressZero, amount, ticket.address).returns()

        await expect(prizePool.withdrawInstantlyFrom(wallet._address, amount, ticket.address, toWei('0.3')))
          .to.be.revertedWith('PrizePool/exit-fee-exceeds-user-maximum')
      })

      it('should limit the size of the fee', async () => {
        let amount = toWei('20')

        // fee is now 4/5 of the withdrawal amount
        await prizePool.setCreditRateOf(ticket.address, toWei('0.01'), toWei('0.8'))

        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet._address).returns(amount)

        await ticket.mock
          .controllerBurnFrom
          .withArgs(wallet._address, wallet._address, amount)
          .returns()

        await cToken.mock
          .redeemUnderlying
          .withArgs(toWei('10'))
          .returns('0')

        await erc20token.mock
          .transfer
          .withArgs(wallet._address, toWei('10'))
          .returns(true)

        await comptroller.mock.beforeTokenTransfer.withArgs(wallet._address, AddressZero, amount, ticket.address).returns()
        await prizeStrategy.mock.beforeTokenTransfer.withArgs(wallet._address, AddressZero, amount, ticket.address).returns()

        // max exit fee is 10, well above
        await expect(prizePool.withdrawInstantlyFrom(wallet._address, amount, ticket.address, toWei('10')))
          .to.emit(prizePool, 'InstantWithdrawal')
          .withArgs(wallet._address, wallet._address, ticket.address, amount, toWei('10'))
      })

      it('should not allow the prize-strategy to set exit fees exceeding the max', async () => {
        let amount = toWei('10')

        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet._address).returns(amount)

        await ticket.mock.controllerBurnFrom.withArgs(wallet._address, wallet._address, amount).returns()
        await cToken.mock.redeemUnderlying.withArgs(toWei('10')).returns('0')
        await erc20token.mock.transfer.withArgs(wallet._address, toWei('10')).returns(true)
        await comptroller.mock.beforeTokenTransfer.withArgs(wallet._address, AddressZero, amount, ticket.address).returns()

        await expect(prizePool.withdrawInstantlyFrom(wallet._address, amount, ticket.address, toWei('0.3')))
          .to.be.revertedWith('PrizePool/exit-fee-exceeds-user-maximum')
      })

      it('should not allow the prize-strategy to set exit fees exceeding the max', async () => {
        let amount = toWei('11')

        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet._address).returns(toWei('10'))

        await ticket.mock.controllerBurnFrom.withArgs(wallet._address, wallet._address, amount).returns()
        await cToken.mock.redeemUnderlying.withArgs(toWei('10')).returns('0')
        await erc20token.mock.transfer.withArgs(wallet._address, toWei('10')).returns(true)
        await comptroller.mock.beforeTokenTransfer.withArgs(wallet._address, AddressZero, amount, ticket.address).returns()

        // PrizeStrategy exit fee: 100.0
        // PrizePool max exit fee: 5.5  (should be capped at this)
        // User max exit fee:      5.6
        await expect(prizePool.withdrawInstantlyFrom(wallet._address, amount, ticket.address, toWei('5.6')))
          .to.not.be.revertedWith('PrizePool/exit-fee-exceeds-user-maximum')
      })
    })

    describe('withdrawWithTimelockFrom()', () => {
      it('should allow a user to withdraw with a timelock', async () => {
        let amount = toWei('10')
        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet._address).returns(amount)

        // force current time
        await prizePool.setCurrentTime('1')

        // expect a ticket burn
        await ticket.mock.controllerBurnFrom.withArgs(wallet._address, wallet._address, amount).returns()

        // expect finish
        await comptroller.mock.beforeTokenTransfer.withArgs(wallet._address, AddressZero, amount, ticket.address).returns()

        // setup timelocked withdrawal
        await prizePool.withdrawWithTimelockFrom(wallet._address, amount, ticket.address)

        expect(await prizePool.timelockBalanceOf(wallet._address)).to.equal(amount)
        expect(await prizePool.timelockBalanceAvailableAt(wallet._address)).to.equal(11)
        expect(await prizePool.timelockTotalSupply()).to.equal(amount)
      })

      it('should limit the duration of the timelock', async () => {

        await prizePool.setCreditRateOf(ticket.address, toWei('0.000000000000000001'), toWei('0.9'))

        let amount = toWei('10')

        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet._address).returns(amount)

        // force current time
        await prizePool.setCurrentTime('1')

        // expect a ticket burn
        await ticket.mock.controllerBurnFrom
          .withArgs(wallet._address, wallet._address, amount)
          .returns()

        // expect finish
        await comptroller.mock.beforeTokenTransfer.withArgs(wallet._address, AddressZero, amount, ticket.address).returns()

        // setup timelocked withdrawal
        await prizePool.withdrawWithTimelockFrom(wallet._address, amount, ticket.address)

        expect(await prizePool.timelockBalanceOf(wallet._address)).to.equal(amount)
        expect(await prizePool.timelockBalanceAvailableAt(wallet._address)).to.equal(1 + poolMaxTimelockDuration) // current time + 10000
        expect(await prizePool.timelockTotalSupply()).to.equal(amount)
      })
    })

    describe('sweepTimelockBalances()', () => {
      it('should do nothing when no balances are available', async () => {
        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns('0')

        // now execute timelock withdrawal
        await expect(prizePool.sweepTimelockBalances([wallet._address]))
          .not.to.emit(prizePool, 'TimelockedWithdrawalSwept')
          .withArgs(wallet._address, wallet._address, toWei('10'))
      })

      it('should sweep only balances that are unlocked', async () => {

        let amount1 = toWei('11')
        let amount2 = toWei('22')

        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns(toWei('33'))
        await ticket.mock.totalSupply.returns(toWei('33'))
        await ticket.mock.balanceOf.withArgs(wallet._address).returns(amount1)
        await ticket.mock.balanceOf.withArgs(wallet2._address).returns(amount2)

        // force current time
        await prizePool.setCurrentTime(1)

        // expect ticket burns from both
        await ticket.mock.controllerBurnFrom.returns()

        await comptroller.mock.beforeTokenTransfer.withArgs(wallet._address, AddressZero, amount1, ticket.address).returns()
        await prizePool.withdrawWithTimelockFrom(wallet._address, amount1, ticket.address)

        // Second will unlock at 21
        await prizePool.setCurrentTime(11)

        await comptroller.mock.beforeTokenTransfer.withArgs(wallet2._address, AddressZero, amount2, ticket.address).returns()
        await prizePool.withdrawWithTimelockFrom(wallet2._address, amount2, ticket.address)

        // Only first deposit is unlocked
        await prizePool.setCurrentTime(15)

        // expect the redeem && transfer for only the unlocked amount
        await cToken.mock.redeemUnderlying.withArgs(amount1).returns('0')
        await erc20token.mock.transfer.withArgs(wallet._address, amount1).returns(true)

        // Let's sweep
        await expect(prizePool.sweepTimelockBalances([wallet._address, wallet2._address]))
          .to.emit(prizePool, 'TimelockedWithdrawalSwept')
          .withArgs(wallet._address, wallet._address, amount1)

        // first user has cleared
        expect(await prizePool.timelockBalanceOf(wallet._address)).to.equal(toWei('0'))
        expect(await prizePool.timelockBalanceAvailableAt(wallet._address)).to.equal('0')

        // second has not
        expect(await prizePool.timelockBalanceOf(wallet2._address)).to.equal(amount2)
        expect(await prizePool.timelockBalanceAvailableAt(wallet2._address)).to.equal(21)

        expect(await prizePool.timelockTotalSupply()).to.equal(amount2)
      })

      it('should sweep timelock balances that have unlocked', async () => {
        let amount = toWei('10')

        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet._address).returns(amount)

        // force current time
        await prizePool.setCurrentTime(1)

        // expect a ticket burn
        await ticket.mock.controllerBurnFrom.withArgs(wallet._address, wallet._address, amount).returns()

        // expect finish
        await comptroller.mock.beforeTokenTransfer.withArgs(wallet._address, AddressZero, amount, ticket.address).returns()

        // setup timelocked withdrawal
        await prizePool.withdrawWithTimelockFrom(wallet._address, amount, ticket.address)

        // expect the redeem && transfer
        await cToken.mock.redeemUnderlying.withArgs(amount).returns('0')
        await erc20token.mock.transfer.withArgs(wallet._address, amount).returns(true)

        // ensure time is after
        await prizePool.setCurrentTime(11)

        // now execute timelock withdrawal
        await expect(prizePool.sweepTimelockBalances([wallet._address]))
          .to.emit(prizePool, 'TimelockedWithdrawalSwept')
          .withArgs(wallet._address, wallet._address, amount)

        expect(await prizePool.timelockBalanceOf(wallet._address)).to.equal('0')
        expect(await prizePool.timelockBalanceAvailableAt(wallet._address)).to.equal('0')
      })
    })

    describe('estimateAccruedInterestOverBlocks()', () => {
      it('should get the supply rate from the yield service to estimate interest per block', async function () {
        const deposit = toWei('100')
        const supplyRate = toWei('0.001')
        const numBlocks = '10'

        await cToken.mock.supplyRatePerBlock.returns(supplyRate)

        expect(await prizePool.estimateAccruedInterestOverBlocks(deposit, numBlocks)).to.deep.equal(toWei('1'))
      })
    })

    describe('balance()', () => {
      it('should return zero if no deposits have been made', async () => {
        await cToken.mock.balanceOfUnderlying.returns(toWei('11'))

        expect((await call(prizePool, 'balance')).toString()).to.equal(toWei('11'))
      })
    })

    describe('tokens()', () => {
      it('should return all tokens', async () => {
        expect(await prizePool.tokens()).to.deep.equal([ticket.address])
      })
    })

    describe('canAwardExternal', () => {
      it('should allow non-ctoken', async () => {
        expect(await prizePool.canAwardExternal(ticket.address)).to.be.true
      })

      it('should not allow ctoken', async () => {
        expect(await prizePool.canAwardExternal(cToken.address)).to.be.false
      })
    })

    describe('addControlledToken()', () => {
      let newToken

      beforeEach(async () => {
        newToken = await deployMockContract(wallet, ControlledToken.abi, overrides)
      })

      it('should allow owner to add controlled tokens', async () => {
        await newToken.mock.controller.returns(prizePool.address)
        await expect(prizePool.addControlledToken(newToken.address))
          .to.emit(prizePool, 'ControlledTokenAdded')
          .withArgs(newToken.address)
      })

      it('should not allow adding uncontrolled tokens', async () => {
        await newToken.mock.controller.returns(newToken.address)
        await expect(prizePool.addControlledToken(newToken.address))
          .to.be.revertedWith('PrizePool/token-ctrlr-mismatch')
      })

      it('should not allow anyone else to call', async () => {
        await expect(prizePool.connect(wallet2).addControlledToken(newToken.address))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })
    })

    describe('setPrizeStrategy()', () => {
      it('should allow the owner to swap the prize strategy', async () => {
        await expect(prizePool.setPrizeStrategy(wallet2._address))
          .to.emit(prizePool, 'PrizeStrategySet')
          .withArgs(wallet2._address)
        expect(await prizePool.prizeStrategy()).to.equal(wallet2._address)
      })

      it('should not allow anyone else to change the prize strategy', async () => {
        await expect(prizePool.connect(wallet2).setPrizeStrategy(wallet2._address)).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    describe('emergencyShutdown()', () => {
      it('should allow owner to detach', async () => {
        await expect(prizePool.emergencyShutdown())
          .to.emit(prizePool, 'EmergencyShutdown')
        expect(await prizePool.comptroller()).to.equal(AddressZero)
      })

      it('should not allow anyone else to call', async () => {
        prizePool2 = prizePool.connect(wallet2)
        await expect(prizePool2.emergencyShutdown()).to.be.revertedWith('Ownable: caller is not the owner')
      })
    })
  })

  describe('with a multi-token prize pool', () => {

    beforeEach(async () => {

      debug('deploying CompoundPrizePoolHarness...')
      multiTokenPrizeStrategy = await deployMockContract(wallet, PrizePoolTokenListenerInterface.abi, overrides)
      multiTokenPrizePool = await deployContract(wallet, CompoundPrizePoolHarness, [], overrides)

      sponsorship = await deployMockContract(wallet, ControlledToken.abi, overrides)

      await ticket.mock.controller.returns(multiTokenPrizePool.address)
      await sponsorship.mock.controller.returns(multiTokenPrizePool.address)

      await multiTokenPrizePool.initializeAll(
        FORWARDER,
        multiTokenPrizeStrategy.address,
        comptroller.address,
        [ticket.address, sponsorship.address],
        poolMaxExitFee,
        poolMaxTimelockDuration,
        cToken.address
      )

      await multiTokenPrizePool.setCreditRateOf(ticket.address, toWei('0.01'), toWei('0.1'))
    })

    describe('accountedBalance()', () => {
      it('should return the total accounted balance for all tokens including timelocked deposits', async () => {
        await ticket.mock.totalSupply.returns(toWei('123'))
        await sponsorship.mock.totalSupply.returns(toWei('456'))
        await multiTokenPrizePool.setTimelockBalance(toWei('789'))

        expect(await multiTokenPrizePool.accountedBalance()).to.equal(toWei('1368'))
      })
    })
  })

  describe('awardExternalERC20()', () => {
    beforeEach(async () => {
      await prizePool.initializeAll(
        FORWARDER,
        wallet._address, // wallet is the prizeStrategy
        comptroller.address,
        [ticket.address],
        poolMaxExitFee,
        poolMaxTimelockDuration,
        cToken.address
      )
      await prizePool.setCreditRateOf(ticket.address, toWei('0.01'), toWei('0.1'))
    })

    it('should exit early when amount = 0', async () => {
      await expect(prizePool.awardExternalERC20(wallet._address, erc20token.address, 0))
        .to.not.emit(prizePool, 'AwardedExternalERC20')
    })

    it('should only allow the prizeStrategy to award external ERC20s', async () => {
      let prizePool2 = prizePool.connect(wallet2)
      await expect(prizePool2.awardExternalERC20(wallet._address, FORWARDER, toWei('10')))
        .to.be.revertedWith('PrizePool/only-prizeStrategy')
    })

    it('should require the token to be allowed', async () => {
      await expect(prizePool.awardExternalERC20(wallet._address, cToken.address, toWei('10')))
        .to.be.revertedWith('PrizePool/invalid-external-token')
    })

    it('should allow arbitrary tokens to be transferred', async () => {
      await erc20token.mock.transfer.withArgs(wallet._address, toWei('10')).returns(true)
      await expect(prizePool.awardExternalERC20(wallet._address, erc20token.address, toWei('10')))
        .to.emit(prizePool, 'AwardedExternalERC20')
        .withArgs(wallet._address, erc20token.address, toWei('10'))
    })
  })

  describe('awardExternalERC721()', () => {
    beforeEach(async () => {
      await prizePool.initializeAll(
        FORWARDER,
        wallet._address, // wallet is the prizeStrategy
        comptroller.address,
        [ticket.address],
        poolMaxExitFee,
        poolMaxTimelockDuration,
        cToken.address
      )
      await prizePool.setCreditRateOf(ticket.address, toWei('0.01'), toWei('0.1'))
    })

    it('should exit early when tokenIds list is empty', async () => {
      await expect(prizePool.awardExternalERC721(wallet._address, erc721token.address, []))
        .to.not.emit(prizePool, 'AwardedExternalERC721')
    })

    it('should only allow the prizeStrategy to award external ERC721s', async () => {
      let prizePool2 = prizePool.connect(wallet2)
      await expect(prizePool2.awardExternalERC721(wallet._address, erc721token.address, [NFT_TOKEN_ID]))
        .to.be.revertedWith('PrizePool/only-prizeStrategy')
    })

    it('should require the token to be allowed', async () => {
      await expect(prizePool.awardExternalERC721(wallet._address, cToken.address, [NFT_TOKEN_ID]))
        .to.be.revertedWith('PrizePool/invalid-external-token')
    })

    it('should allow arbitrary tokens to be transferred', async () => {
      await erc721token.mock.transferFrom.withArgs(prizePool.address, wallet._address, NFT_TOKEN_ID).returns()
      await expect(prizePool.awardExternalERC721(wallet._address, erc721token.address, [NFT_TOKEN_ID]))
        .to.emit(prizePool, 'AwardedExternalERC721')
        .withArgs(wallet._address, erc721token.address, [NFT_TOKEN_ID])
    })
  })

  describe('that has been emergency shutdown', () => {
    let shutdownPrizePool
    let ticket2

    beforeEach(async () => {
      debug('deploying CompoundPrizePoolHarness...')
      shutdownPrizePool = await deployContract(wallet, CompoundPrizePoolHarness, [], overrides)

      await ticket.mock.controller.returns(shutdownPrizePool.address)

      debug('initializing PrizePool...')
      await shutdownPrizePool.initializeAll(
        FORWARDER,
        prizeStrategy.address,    // Prize Strategy
        comptroller.address,
        [ticket.address],
        poolMaxExitFee,
        poolMaxTimelockDuration,
        cToken.address
      )

      debug('shutting down pool...')
      await shutdownPrizePool.emergencyShutdown();
    })

    describe('depositTo()', () => {
      it('should NOT mint tokens to the user', async () => {
        await expect(shutdownPrizePool.depositTo(wallet2._address, toWei('1'), ticket.address, AddressZero))
          .to.be.revertedWith('PrizePool/shutdown')
      })
    })

    describe('withdrawInstantlyFrom()', () => {
      it('should allow a user to withdraw instantly', async () => {
        let amount = toWei('11')

        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns('0')
        await ticket.mock.balanceOf.withArgs(wallet._address).returns(amount)

        await ticket.mock.controllerBurnFrom.withArgs(wallet._address, wallet._address, amount).returns()
        await cToken.mock.redeemUnderlying.withArgs(toWei('11')).returns('0')
        await erc20token.mock.transfer.withArgs(wallet._address, toWei('11')).returns(true)
        await comptroller.mock.beforeTokenTransfer.withArgs(wallet._address, AddressZero, amount, ticket.address).returns()

        await expect(shutdownPrizePool.withdrawInstantlyFrom(wallet._address, amount, ticket.address, toWei('1')))
          .to.emit(shutdownPrizePool, 'InstantWithdrawal')
          .withArgs(wallet._address, wallet._address, ticket.address, amount, toWei('0'))
      })
    })

    describe('withdrawWithTimelockFrom()', () => {
      it('should allow a user to withdraw with a timelock', async () => {
        let amount = toWei('10')

        // updateAwardBalance
        await cToken.mock.balanceOfUnderlying.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet._address).returns(amount)

        // force current time
        await shutdownPrizePool.setCurrentTime('1')

        // expect a ticket burn
        await ticket.mock.controllerBurnFrom.withArgs(wallet._address, wallet._address, amount).returns()
        await cToken.mock.redeemUnderlying.withArgs(amount).returns('0')

        // expect comptroller signal
        await comptroller.mock.beforeTokenTransfer.withArgs(wallet._address, AddressZero, amount, ticket.address).returns()
        // full-amount should be tansferred
        await erc20token.mock.transfer.withArgs(wallet._address, amount).returns(true)
        await shutdownPrizePool.withdrawWithTimelockFrom(wallet._address, amount, ticket.address)

        expect(await shutdownPrizePool.timelockBalanceOf(wallet._address)).to.equal(toWei('0'))
        expect(await shutdownPrizePool.timelockBalanceAvailableAt(wallet._address)).to.equal('0')
        expect(await shutdownPrizePool.timelockTotalSupply()).to.equal(toWei('0'))
      })
    })
  })
});
