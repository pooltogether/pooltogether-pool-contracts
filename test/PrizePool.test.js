const { deployMockContract } = require('ethereum-waffle')

const { ethers } = require('ethers')
const { expect } = require('chai')
const hardhat = require('hardhat')
const { call } = require('./helpers/call')
const { AddressZero } = require('ethers').constants

const toWei = ethers.utils.parseEther
const fromWei = ethers.utils.formatEther

const debug = require('debug')('ptv3:PrizePool.test')

let overrides = { gasLimit: 9500000 }

const NFT_TOKEN_ID = 1

describe('PrizePool', function() {
  let wallet, wallet2

  let prizePool, erc20token, erc721token, yieldSourceStub, prizeStrategy, reserve, reserveRegistry
  let multiTokenPrizePool, multiTokenPrizeStrategy

  let poolMaxExitFee = toWei('0.5')

  let ticket, sponsorship, nft

  let compLike

  beforeEach(async () => {
    [wallet, wallet2] = await hardhat.ethers.getSigners()
    debug(`using wallet ${wallet.address}`)

    debug('mocking tokens...')
    const IERC20 = await hre.artifacts.readArtifact("IERC20Upgradeable")
    erc20token = await deployMockContract(wallet, IERC20.abi, overrides)

    const ICompLike = await hre.artifacts.readArtifact("ICompLike")
    compLike = await deployMockContract(wallet, ICompLike.abi, overrides)

    const IERC721 = await hre.artifacts.readArtifact("IERC721Upgradeable")
    erc721token = await deployMockContract(wallet, IERC721.abi, overrides)

    const YieldSourceStub = await hre.artifacts.readArtifact("YieldSourceStub")
    yieldSourceStub = await deployMockContract(wallet, YieldSourceStub.abi, overrides)
    await yieldSourceStub.mock.token.returns(erc20token.address)

    const TokenListenerInterface = await hre.artifacts.readArtifact("TokenListenerInterface")
    prizeStrategy = await deployMockContract(wallet, TokenListenerInterface.abi, overrides)

    await prizeStrategy.mock.supportsInterface.returns(true)
    await prizeStrategy.mock.supportsInterface.withArgs('0xffffffff').returns(false)

    const ReserveInterface = await hre.artifacts.readArtifact("ReserveInterface")
    reserve = await deployMockContract(wallet, ReserveInterface.abi, overrides)

    const RegistryInterface = await hre.artifacts.readArtifact("RegistryInterface")
    reserveRegistry = await deployMockContract(wallet, RegistryInterface.abi, overrides)
    await reserveRegistry.mock.lookup.returns(reserve.address)

    debug('deploying PrizePoolHarness...')
    const PrizePoolHarness = await hre.ethers.getContractFactory("PrizePoolHarness", wallet, overrides)
    prizePool = await PrizePoolHarness.deploy()

    const ControlledToken = await hre.artifacts.readArtifact("ControlledToken")
    ticket = await deployMockContract(wallet, ControlledToken.abi, overrides)
    await ticket.mock.controller.returns(prizePool.address)
  })

  describe('initialize()', () => {
    it('should fire the events', async () => {
      let tx = prizePool.initializeAll(
        reserve.address,
        [ticket.address],
        poolMaxExitFee,
        yieldSourceStub.address
      )

      await expect(tx)
        .to.emit(prizePool, 'Initialized')
        .withArgs(
          reserve.address,
          poolMaxExitFee
        )

      await expect(tx)
        .to.emit(prizePool, 'ControlledTokenAdded')
        .withArgs(
          ticket.address
        )

      await expect(prizePool.setPrizeStrategy(prizeStrategy.address))
        .to.emit(prizePool, 'PrizeStrategySet')
        .withArgs(prizeStrategy.address)

    })
  })

  describe('with a mocked prize pool', () => {
    beforeEach(async () => {
      await prizePool.initializeAll(
        reserveRegistry.address,
        [ticket.address],
        poolMaxExitFee,
        yieldSourceStub.address
      )
      await prizePool.setPrizeStrategy(prizeStrategy.address)
      // Credit rate is 1% per second, credit limit is 10%
      await prizePool.setCreditPlanOf(ticket.address, toWei('0.01'), toWei('0.1'))
    })

    describe("beforeTokenTransfer()", () => {
      it('should not allow uncontrolled tokens to call', async () => {
        await expect(prizePool.beforeTokenTransfer(wallet.address, wallet2.address, toWei('1')))
          .to.be.revertedWith('PrizePool/unknown-token')
      })

      it('should allow controlled tokens to call', async () => {
        await ticket.mock.balanceOf.withArgs(wallet.address).returns(toWei('10'))
        await ticket.mock.balanceOf.withArgs(wallet2.address).returns(toWei('10'))

        await prizeStrategy.mock.beforeTokenTransfer.withArgs(wallet.address, wallet2.address, toWei('1'), ticket.address).returns()
        await ticket.call(prizePool, 'beforeTokenTransfer', wallet.address, wallet2.address, toWei('1'))
      })

      it('should accrue credit to the sender and receiver', async () => {
        await ticket.mock.balanceOf.withArgs(wallet.address).returns(toWei('100'))
        await ticket.mock.balanceOf.withArgs(wallet2.address).returns(toWei('10'))

        debug(`calculateEarlyExitFee...`)
        await prizePool.setCurrentTime(0)
        // trigger credit init
        await prizePool.calculateEarlyExitFee(wallet.address, ticket.address, 42)
        await prizePool.calculateEarlyExitFee(wallet2.address, ticket.address, 42)

        debug(`beforeTokenTransfer...`)
        await prizePool.setCurrentTime(5)
        // wallet will have accrued 5 dai of credit
        await prizeStrategy.mock.beforeTokenTransfer.withArgs(wallet.address, wallet2.address, toWei('50'), ticket.address).returns()
        await ticket.call(prizePool, 'beforeTokenTransfer', wallet.address, wallet2.address, toWei('50'))

        debug(`balanceOfCredit...`)
        expect(await call(prizePool, 'balanceOfCredit', wallet.address, ticket.address)).to.equal(toWei('5'))
        expect(await call(prizePool, 'balanceOfCredit', wallet2.address, ticket.address)).to.equal(toWei('0.5'))
      })

      it('should allow a user to transfer to themselves', async () => {
        await ticket.mock.balanceOf.withArgs(wallet.address).returns(toWei('100'))

        debug(`calculateEarlyExitFee...`)
        await prizePool.setCurrentTime(0)
        // trigger credit init
        await prizePool.calculateEarlyExitFee(wallet.address, ticket.address, toWei('100'))

        debug(`beforeTokenTransfer...`)
        await prizePool.setCurrentTime(10)
        await prizeStrategy.mock.beforeTokenTransfer.withArgs(wallet.address, wallet.address, toWei('50'), ticket.address).returns()
        await ticket.call(prizePool, 'beforeTokenTransfer', wallet.address, wallet.address, toWei('50'))

        debug(`balanceOfCredit...`)
        expect(await call(prizePool, 'balanceOfCredit', wallet.address, ticket.address)).to.equal(toWei('10'))
      })

      it('should accrue credit to the sender, but ensure the new credit limit is respected', async () => {
        await ticket.mock.balanceOf.withArgs(wallet.address).returns(toWei('100'))
        await ticket.mock.balanceOf.withArgs(wallet2.address).returns(toWei('10'))

        debug(`calculateEarlyExitFee...`)
        await prizePool.setCurrentTime(0)
        // trigger credit init
        await prizePool.calculateEarlyExitFee(wallet.address, ticket.address, 42)
        await prizePool.calculateEarlyExitFee(wallet2.address, ticket.address, 42)

        debug(`beforeTokenTransfer...`)
        await prizePool.setCurrentTime(10)
        // wallet should have accrued the maximum of 10
        await prizeStrategy.mock.beforeTokenTransfer.withArgs(wallet.address, wallet2.address, toWei('50'), ticket.address).returns()
        // now ensure credit is limited
        await ticket.call(prizePool, 'beforeTokenTransfer', wallet.address, wallet2.address, toWei('50'))

        debug(`balanceOfCredit...`)
        // credit should be limited to their *new* balance of 50
        expect(await call(prizePool, 'balanceOfCredit', wallet.address, ticket.address)).to.equal(toWei('5'))
        expect(await call(prizePool, 'balanceOfCredit', wallet2.address, ticket.address)).to.equal(toWei('1'))
      })
    })

    describe('initialize()', () => {
      it('should set all the vars', async () => {
        expect(await prizePool.token()).to.equal(erc20token.address)
        expect(await prizePool.reserveRegistry()).to.equal(reserveRegistry.address)
      })

      it('should reject invalid params', async () => {
        const _initArgs = [
          reserveRegistry.address,
          [ticket.address],
          poolMaxExitFee,
          yieldSourceStub.address
        ]
        let initArgs

        debug('deploying secondary prizePool...')
        const PrizePoolHarness = await hre.ethers.getContractFactory("PrizePoolHarness", wallet, overrides)
        const prizePool2 = await PrizePoolHarness.deploy()

        debug('testing initialization of secondary prizeStrategy...')

        initArgs = _initArgs.slice(); initArgs[0] = AddressZero
        await expect(prizePool2.initializeAll(...initArgs)).to.be.revertedWith('PrizePool/reserveRegistry-not-zero')

        initArgs = _initArgs.slice()
        await ticket.mock.controller.returns(AddressZero)
        await expect(prizePool2.initializeAll(...initArgs)).to.be.revertedWith('PrizePool/token-ctrlr-mismatch')
      })
    })

    describe('depositTo()', () => {
      it('should revert when deposit exceeds liquidity cap', async () => {
        const amount = toWei('1')
        const liquidityCap = toWei('1000')

        await ticket.mock.totalSupply.returns(liquidityCap)
        await prizePool.setLiquidityCap(liquidityCap)

        await expect(prizePool.depositTo(wallet2.address, amount, ticket.address, AddressZero))
          .to.be.revertedWith("PrizePool/exceeds-liquidity-cap")
      })
    })

    describe('captureAwardBalance()', () => {
      it('should handle when the balance is less than the collateral', async () => {
        await ticket.mock.totalSupply.returns(toWei('100'))
        await yieldSourceStub.mock.balance.returns(toWei('99.9999'))

        await expect(prizePool.captureAwardBalance()).to.not.emit(prizePool, 'ReserveFeeCaptured');
        expect(await prizePool.awardBalance()).to.equal(toWei('0'))
      })

      it('should handle the situ when the total accrued interest is less than the captured total', async () => {
        await ticket.mock.totalSupply.returns(toWei('100'))
        await yieldSourceStub.mock.balance.returns(toWei('110'))

        await reserve.mock.reserveRateMantissa.returns('0')

        // first capture the 10 tokens
        await prizePool.captureAwardBalance()

        await yieldSourceStub.mock.balance.returns(toWei('109.999'))
        // now try to capture again
        await expect(
          prizePool.captureAwardBalance()
        ).to.not.emit(prizePool, 'AwardCaptured')
      })

      it('should track the yield less the total token supply', async () => {
        await ticket.mock.totalSupply.returns(toWei('100'))
        await yieldSourceStub.mock.balance.returns(toWei('110'))
        await reserve.mock.reserveRateMantissa.returns('0')

        await expect(prizePool.captureAwardBalance()).to.not.emit(prizePool, 'ReserveFeeCaptured');
        expect(await prizePool.awardBalance()).to.equal(toWei('10'))
      })

      it('should capture the reserve fees', async () => {
        const reserveFee = toWei('1')

        await reserve.mock.reserveRateMantissa.returns(toWei('0.01'))

        await ticket.mock.totalSupply.returns(toWei('1000'))
        await yieldSourceStub.mock.balance.returns(toWei('1100'))

        let tx = prizePool.captureAwardBalance()

        await expect(tx)
          .to.emit(prizePool, 'ReserveFeeCaptured')
          .withArgs(reserveFee)

        await expect(tx)
          .to.emit(prizePool, 'AwardCaptured')
          .withArgs(toWei('99'))

        expect(await prizePool.awardBalance()).to.equal(toWei('99'))
        expect(await prizePool.reserveTotalSupply()).to.equal(reserveFee)
      })
    })

    describe('calculateReserveFee()', () => {
      it('should return zero when no reserve fee is set', async () => {
        await reserve.mock.reserveRateMantissa.returns(toWei('0'))
        expect(await prizePool.calculateReserveFee(toWei('1'))).to.equal(toWei('0'))
      })

      it('should calculate an accurate reserve fee on a given amount', async () => {
        await reserve.mock.reserveRateMantissa.returns(toWei('0.5'))
        expect(await prizePool.calculateReserveFee(toWei('1'))).to.equal(toWei('0.5'))
      })
    })

    describe('withdrawReserve()', () => {
      it('should allow the reserve to be withdrawn', async () => {
        await reserve.mock.reserveRateMantissa.returns(toWei('0.01'))

        await ticket.mock.totalSupply.returns(toWei('1000'))
        await yieldSourceStub.mock.balance.returns(toWei('1100'))

        await erc20token.mock.transfer.withArgs(wallet.address, toWei('0.8')).returns(true)

        // capture the reserve of 1 token
        await prizePool.captureAwardBalance()
        
        await yieldSourceStub.mock.redeem.withArgs(toWei('1')).returns(toWei('0.8'))

        await reserve.call(prizePool, 'withdrawReserve', wallet.address)

        expect(await prizePool.reserveTotalSupply()).to.equal('0')
      })
    })

    describe('calculateEarlyExitFee', () => {
      it('should return the early exit for for a withdrawal', async () => {
        // Rate: 1%, Limit: 10%
        await prizePool.setCreditPlanOf(ticket.address, toWei('0.01'), toWei('0.1'))

        let amount = toWei('10')

        // await yieldSourceStub.mock.balance.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet.address).returns(amount)

        // force current time
        await prizePool.setCurrentTime('10')

        // Full period early = 10%
        expect(await call(prizePool, 'calculateEarlyExitFee', wallet.address, ticket.address, amount)).to.deep.equal([
          toWei('1'),
          toWei('0')
        ])
        // accrue credit
        await prizePool.calculateEarlyExitFee(wallet.address, ticket.address, amount)

        // move forward 5 seconds
        await prizePool.setCurrentTime('15')

        // credit should be included
        expect(await call(prizePool, 'calculateEarlyExitFee', wallet.address, ticket.address, amount)).to.deep.equal([
          toWei('0.5'),
          toWei('0.5')
        ])

        // accrue credit
        await prizePool.calculateEarlyExitFee(wallet.address, ticket.address, amount)
        expect(await call(prizePool, 'balanceOfCredit', wallet.address, ticket.address)).to.equal(toWei('0.5'))
      })

      it('should track credit accurately with tiny balances', async () => {
        // Rate: 0.1%, Limit: 10%
        await prizePool.setCreditPlanOf(ticket.address, toWei('0.001'), toWei('0.1'))

        // user has 100 tickets
        let amount = '100'
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet.address).returns(amount)
        
        await prizePool.setCurrentTime('10')

        expect(await call(prizePool, 'calculateEarlyExitFee', wallet.address, ticket.address, amount)).to.deep.equal([
          ethers.BigNumber.from('10'),
          ethers.BigNumber.from('0')
        ])

        // init & accrue the credit
        await prizePool.calculateEarlyExitFee(wallet.address, ticket.address, amount)

        // 12 seconds have passed, which means 1.2% has accrued, which is 1 "wei".
        await prizePool.setCurrentTime('22')

        expect(await call(prizePool, 'calculateEarlyExitFee', wallet.address, ticket.address, amount)).to.deep.equal([
          ethers.BigNumber.from('9'),
          ethers.BigNumber.from('1')
        ])
      })
    })

    describe('withdrawInstantlyFrom()', () => {
      it('should allow a user to withdraw instantly', async () => {
        let amount = toWei('10')

        // updateAwardBalance
        await yieldSourceStub.mock.balance.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet.address).returns(amount)

        await ticket.mock.controllerBurnFrom.withArgs(wallet.address, wallet.address, amount).returns()
        await yieldSourceStub.mock.redeem.withArgs(toWei('9')).returns(toWei('9'))
        await erc20token.mock.transfer.withArgs(wallet.address, toWei('9')).returns(true)

        await expect(prizePool.withdrawInstantlyFrom(wallet.address, amount, ticket.address, toWei('1')))
          .to.emit(prizePool, 'InstantWithdrawal')
          .withArgs(wallet.address, wallet.address, ticket.address, amount, toWei('9'), toWei('1'))
      })

      it('should only transfer to the user the amount that was redeemed', async () => {
        let amount = toWei('10')
        let redeemed = toWei('8')

        // updateAwardBalance
        await yieldSourceStub.mock.balance.returns('0')
        await ticket.mock.totalSupply.returns('0')
        await ticket.mock.balanceOf.withArgs(wallet.address).returns(toWei('10'))

        await ticket.mock.controllerBurnFrom.withArgs(wallet.address, wallet.address, amount).returns()
        await yieldSourceStub.mock.redeem.withArgs(toWei('9')).returns(redeemed)
        await erc20token.mock.transfer.withArgs(wallet.address, redeemed).returns(true)

        await expect(prizePool.withdrawInstantlyFrom(wallet.address, amount, ticket.address, toWei('1')))
          .to.emit(prizePool, 'InstantWithdrawal')
          .withArgs(wallet.address, wallet.address, ticket.address, amount, redeemed, toWei('1'))
      })

      it('should allow a user to set a maximum exit fee', async () => {
        let amount = toWei('10')
        let fee = toWei('1')

        let redeemed = amount.sub(fee)

        // updateAwardBalance
        await yieldSourceStub.mock.balance.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet.address).returns(toWei('10'))

        await ticket.mock.controllerBurnFrom.withArgs(wallet2.address, wallet.address, amount).returns()
        await yieldSourceStub.mock.redeem.withArgs(redeemed).returns(redeemed)
        await erc20token.mock.transfer.withArgs(wallet.address, redeemed).returns(true)

        await expect(prizePool.connect(wallet2).withdrawInstantlyFrom(wallet.address, amount, ticket.address, fee))
          .to.emit(prizePool, 'InstantWithdrawal')
          .withArgs(wallet2.address, wallet.address, ticket.address, amount, redeemed, fee)
      })

      it('should revert if fee exceeds the user maximum', async () => {
        let amount = toWei('10')

        const redeemed = toWei('9')

        // updateAwardBalance
        await yieldSourceStub.mock.balance.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet.address).returns(amount)

        await ticket.mock.controllerBurnFrom.withArgs(wallet.address, wallet.address, amount).returns()
        await yieldSourceStub.mock.redeem.withArgs(redeemed).returns(redeemed)
        await erc20token.mock.transfer.withArgs(wallet.address, toWei('10')).returns(true)

        await expect(prizePool.withdrawInstantlyFrom(wallet.address, amount, ticket.address, toWei('0.3')))
          .to.be.revertedWith('PrizePool/exit-fee-exceeds-user-maximum')
      })

      it('should limit the size of the fee', async () => {
        let amount = toWei('20')

        // fee is now 4/5 of the withdrawal amount
        await prizePool.setCreditPlanOf(ticket.address, toWei('0.01'), toWei('0.8'))

        // updateAwardBalance
        await yieldSourceStub.mock.balance.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet.address).returns(amount)

        await ticket.mock
          .controllerBurnFrom
          .withArgs(wallet.address, wallet.address, amount)
          .returns()

        await yieldSourceStub.mock
          .redeem
          .withArgs(toWei('10'))
          .returns(toWei('10'))

        await erc20token.mock
          .transfer
          .withArgs(wallet.address, toWei('10'))
          .returns(true)


        // max exit fee is 10, well above
        await expect(prizePool.withdrawInstantlyFrom(wallet.address, amount, ticket.address, toWei('10')))
          .to.emit(prizePool, 'InstantWithdrawal')
          .withArgs(wallet.address, wallet.address, ticket.address, amount, toWei('10'), toWei('10'))
      })

      it('should not allow the prize-strategy to set exit fees exceeding the max', async () => {
        let amount = toWei('10')

        // updateAwardBalance
        await yieldSourceStub.mock.balance.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet.address).returns(amount)

        await ticket.mock.controllerBurnFrom.withArgs(wallet.address, wallet.address, amount).returns()
        await yieldSourceStub.mock.redeem.withArgs(toWei('10')).returns(toWei('10'))
        await erc20token.mock.transfer.withArgs(wallet.address, toWei('10')).returns(true)

        await expect(prizePool.withdrawInstantlyFrom(wallet.address, amount, ticket.address, toWei('0.3')))
          .to.be.revertedWith('PrizePool/exit-fee-exceeds-user-maximum')
      })

      it('should not allow the prize-strategy to set exit fees exceeding the max', async () => {
        let amount = toWei('11')

        // updateAwardBalance
        await yieldSourceStub.mock.balance.returns('0')
        await ticket.mock.totalSupply.returns(amount)
        await ticket.mock.balanceOf.withArgs(wallet.address).returns(toWei('10'))

        await ticket.mock.controllerBurnFrom.withArgs(wallet.address, wallet.address, amount).returns()
        await yieldSourceStub.mock.redeem.withArgs(toWei('10')).returns(toWei('10'))
        await erc20token.mock.transfer.withArgs(wallet.address, toWei('10')).returns(true)

        // PrizeStrategy exit fee: 100.0
        // PrizePool max exit fee: 5.5  (should be capped at this)
        // User max exit fee:      5.6
        await expect(prizePool.withdrawInstantlyFrom(wallet.address, amount, ticket.address, toWei('5.6')))
          .to.not.be.revertedWith('PrizePool/exit-fee-exceeds-user-maximum')
      })
    })

    describe('balance()', () => {
      it('should return zero if no deposits have been made', async () => {
        await yieldSourceStub.mock.balance.returns(toWei('11'))

        expect((await call(prizePool, 'balance')).toString()).to.equal(toWei('11'))
      })
    })

    describe('tokens()', () => {
      it('should return all tokens', async () => {
        expect(await prizePool.tokens()).to.deep.equal([ticket.address])
      })
    })

    describe('setPrizeStrategy()', () => {
      it('should allow the owner to swap the prize strategy', async () => {
        await expect(prizePool.setPrizeStrategy(prizeStrategy.address))
          .to.emit(prizePool, 'PrizeStrategySet')
          .withArgs(prizeStrategy.address)
        expect(await prizePool.prizeStrategy()).to.equal(prizeStrategy.address)
      })

      it('should not allow anyone else to change the prize strategy', async () => {
        await expect(prizePool.connect(wallet2).setPrizeStrategy(wallet2.address)).to.be.revertedWith("Ownable: caller is not the owner")
      })
    })

    describe('setLiquidityCap', () => {
      it('should allow the owner to set the liquidity cap', async () => {
        const liquidityCap = toWei('1000')

        await ticket.mock.totalSupply.returns('0')

        await expect(prizePool.setLiquidityCap(liquidityCap))
          .to.emit(prizePool, 'LiquidityCapSet')
          .withArgs(liquidityCap)
        expect(await prizePool.liquidityCap()).to.equal(liquidityCap)
      })

      it('should not allow anyone else to call', async () => {
        prizePool2 = prizePool.connect(wallet2)
        await expect(prizePool2.setLiquidityCap(toWei('1000'))).to.be.revertedWith('Ownable: caller is not the owner')
      })
    })

    describe('compLikeDelegate()', () => {
      it('should delegate votes', async () => {
        await compLike.mock.balanceOf.withArgs(prizePool.address).returns('1')
        await compLike.mock.delegate.withArgs(wallet2.address).revertsWithReason("hello")
        await expect(prizePool.compLikeDelegate(compLike.address, wallet2.address)).to.be.revertedWith("hello")
      })

      it('should only allow the owner to delegate', async () => {
        await expect(prizePool.connect(wallet2).compLikeDelegate(compLike.address, wallet2.address)).to.be.revertedWith("Ownable: caller is not the owner")
      })

      it('should not delegate if the balance is zero', async () => {
        await compLike.mock.balanceOf.withArgs(prizePool.address).returns('0')
        await prizePool.compLikeDelegate(compLike.address, wallet2.address)
      })
    })
  })

  describe('with a multi-token prize pool', () => {

    beforeEach(async () => {

      debug('deploying PrizePoolHarness...')
      const TokenListenerInterface = await hre.artifacts.readArtifact("TokenListenerInterface")
  
      multiTokenPrizeStrategy = await deployMockContract(wallet, TokenListenerInterface.abi, overrides)
      await multiTokenPrizeStrategy.mock.supportsInterface.returns(true)
      await multiTokenPrizeStrategy.mock.supportsInterface.withArgs('0xffffffff').returns(false)


      const PrizePoolHarness = await hre.ethers.getContractFactory("PrizePoolHarness", wallet, overrides)
      multiTokenPrizePool = await PrizePoolHarness.deploy()

      const ControlledToken = await hre.artifacts.readArtifact("ControlledToken")
      sponsorship = await deployMockContract(wallet, ControlledToken.abi, overrides)

      await ticket.mock.controller.returns(multiTokenPrizePool.address)
      await sponsorship.mock.controller.returns(multiTokenPrizePool.address)

      await multiTokenPrizePool.initializeAll(
        reserveRegistry.address,
        [ticket.address, sponsorship.address],
        poolMaxExitFee,
        yieldSourceStub.address
      )

      await multiTokenPrizePool.setPrizeStrategy(multiTokenPrizeStrategy.address)
      await multiTokenPrizePool.setCreditPlanOf(ticket.address, toWei('0.01'), toWei('0.1'))
    })

    describe('accountedBalance()', () => {
      it('should return the total accounted balance for all tokens', async () => {
        await ticket.mock.totalSupply.returns(toWei('123'))
        await sponsorship.mock.totalSupply.returns(toWei('456'))


        expect(await multiTokenPrizePool.accountedBalance()).to.equal(toWei('579'))
      })

      it('should include the reserve', async () => {
        await ticket.mock.totalSupply.returns(toWei('50'))
        await sponsorship.mock.totalSupply.returns(toWei('50'))
        await yieldSourceStub.mock.balance.returns(toWei('110'))
        await reserve.mock.reserveRateMantissa.returns(toWei('0.1'))

        // first capture the 10 tokens as 9 prize and 1 reserve
        await multiTokenPrizePool.captureAwardBalance()

        await yieldSourceStub.mock.balance.returns(toWei('110'))
        // now try to capture again
        expect(
          await multiTokenPrizePool.accountedBalance()
        ).to.equal(toWei('101'))
      })
    })
  })

  describe('awardExternalERC20()', () => {
    beforeEach(async () => {
      await prizePool.initializeAll(
        prizeStrategy.address,
        [ticket.address],
        poolMaxExitFee,
        yieldSourceStub.address
      )
      await prizePool.setPrizeStrategy(prizeStrategy.address)
      await prizePool.setCreditPlanOf(ticket.address, toWei('0.01'), toWei('0.1'))
    })

    it('should exit early when amount = 0', async () => {
      await yieldSourceStub.mock.canAwardExternal.withArgs(erc20token.address).returns(true)
      await expect(prizeStrategy.call(prizePool, 'awardExternalERC20', wallet.address, erc20token.address, 0))
        .to.not.emit(prizePool, 'AwardedExternalERC20')
    })

    it('should only allow the prizeStrategy to award external ERC20s', async () => {
      await yieldSourceStub.mock.canAwardExternal.withArgs(erc20token.address).returns(true)
      let prizePool2 = prizePool.connect(wallet2)
      await expect(prizePool2.awardExternalERC20(wallet.address, wallet2.address, toWei('10')))
        .to.be.revertedWith('PrizePool/only-prizeStrategy')
    })

    it('should allow arbitrary tokens to be transferred', async () => {
      await yieldSourceStub.mock.canAwardExternal.withArgs(erc20token.address).returns(true)
      await erc20token.mock.transfer.withArgs(wallet.address, toWei('10')).returns(true)
      await expect(prizeStrategy.call(prizePool, 'awardExternalERC20', wallet.address, erc20token.address, toWei('10')))
        .to.emit(prizePool, 'AwardedExternalERC20')
        .withArgs(wallet.address, erc20token.address, toWei('10'))
    })
  })

  describe('transferExternalERC20()', () => {
    beforeEach(async () => {
      await prizePool.initializeAll(
        prizeStrategy.address,
        [ticket.address],
        poolMaxExitFee,
        yieldSourceStub.address
      )
      await prizePool.setPrizeStrategy(prizeStrategy.address)
      await prizePool.setCreditPlanOf(ticket.address, toWei('0.01'), toWei('0.1'))
    })

    it('should exit early when amount = 0', async () => {
      await yieldSourceStub.mock.canAwardExternal.withArgs(erc20token.address).returns(true)
      await expect(prizeStrategy.call(prizePool, 'transferExternalERC20', wallet.address, erc20token.address, 0))
        .to.not.emit(prizePool, 'TransferredExternalERC20')
    })

    it('should only allow the prizeStrategy to award external ERC20s', async () => {
      await yieldSourceStub.mock.canAwardExternal.withArgs(erc20token.address).returns(true)
      let prizePool2 = prizePool.connect(wallet2)
      await expect(prizePool2.transferExternalERC20(wallet.address, wallet2.address, toWei('10')))
        .to.be.revertedWith('PrizePool/only-prizeStrategy')
    })

    it('should allow arbitrary tokens to be transferred', async () => {
      await yieldSourceStub.mock.canAwardExternal.withArgs(erc20token.address).returns(true)
      await erc20token.mock.transfer.withArgs(wallet.address, toWei('10')).returns(true)
      await expect(prizeStrategy.call(prizePool, 'transferExternalERC20', wallet.address, erc20token.address, toWei('10')))
        .to.emit(prizePool, 'TransferredExternalERC20')
        .withArgs(wallet.address, erc20token.address, toWei('10'))
    })

  })

  describe('awardExternalERC721()', () => {
    beforeEach(async () => {
      await prizePool.initializeAll(
        prizeStrategy.address,
        [ticket.address],
        poolMaxExitFee,
        yieldSourceStub.address
      )
      await prizePool.setPrizeStrategy(prizeStrategy.address)
      await prizePool.setCreditPlanOf(ticket.address, toWei('0.01'), toWei('0.1'))
    })

    it('should exit early when tokenIds list is empty', async () => {
      await yieldSourceStub.mock.canAwardExternal.withArgs(erc721token.address).returns(true)
      await expect(prizeStrategy.call(prizePool, 'awardExternalERC721', wallet.address, erc721token.address, []))
        .to.not.emit(prizePool, 'AwardedExternalERC721')
    })

    it('should only allow the prizeStrategy to award external ERC721s', async () => {
      await yieldSourceStub.mock.canAwardExternal.withArgs(erc721token.address).returns(true)
      let prizePool2 = prizePool.connect(wallet2)
      await expect(prizePool2.awardExternalERC721(wallet.address, erc721token.address, [NFT_TOKEN_ID]))
        .to.be.revertedWith('PrizePool/only-prizeStrategy')
    })

    it('should allow arbitrary tokens to be transferred', async () => {
      await yieldSourceStub.mock.canAwardExternal.withArgs(erc721token.address).returns(true)
      await erc721token.mock.transferFrom.withArgs(prizePool.address, wallet.address, NFT_TOKEN_ID).returns()
      await expect(prizeStrategy.call(prizePool, 'awardExternalERC721', wallet.address, erc721token.address, [NFT_TOKEN_ID]))
        .to.emit(prizePool, 'AwardedExternalERC721')
        .withArgs(wallet.address, erc721token.address, [NFT_TOKEN_ID])
    })

    it('should not DoS with faulty ERC721s', async () => {

      await yieldSourceStub.mock.canAwardExternal.withArgs(erc721token.address).returns(true)
      await erc721token.mock.transferFrom.withArgs(prizePool.address, wallet.address, NFT_TOKEN_ID).reverts()

      await expect(prizeStrategy.call(prizePool, 'awardExternalERC721', wallet.address, erc721token.address, [NFT_TOKEN_ID]))
      .to.emit(prizePool, 'ErrorAwardingExternalERC721')
    })
  })

  describe('onERC721Received()', () => {
    beforeEach(async () => {
      await prizePool.initializeAll(
        prizeStrategy.address,
        [ticket.address],
        poolMaxExitFee,
        yieldSourceStub.address
      )
      await prizePool.setPrizeStrategy(prizeStrategy.address)
      await prizePool.setCreditPlanOf(ticket.address, toWei('0.01'), toWei('0.1'))
      debug('deploying NFT test contract...')
      const NFTFactory = await hre.ethers.getContractFactory("NFT", wallet, overrides)
      NFT = await NFTFactory.deploy()
      await NFT.initialize('NFT Token', 'NFT')
    })

    it('should receive an ERC721 token when using safeTransferFrom', async () => {
      expect(await NFT.balanceOf(prizePool.address)).to.equal('0')
      expect(await NFT.simulateSafeTransferFrom(wallet.address, prizePool.address, 0))
        .to.emit(NFT, 'Transfer')
        .withArgs(wallet.address, prizePool.address, 0);
      expect(await NFT.balanceOf(prizePool.address)).to.equal('1')
    })

  })
});
