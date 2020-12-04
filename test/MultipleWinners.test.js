const { deployContract } = require('ethereum-waffle')
const { deployMockContract } = require('./helpers/deployMockContract')
const { call } = require('./helpers/call')
const { deploy1820 } = require('deploy-eip-1820')
const TokenListenerInterface = require('../build/TokenListenerInterface.json')
const TokenControllerInterface = require('../build/TokenControllerInterface.json')
const MultipleWinnersHarness = require('../build/MultipleWinnersHarness.json')
const PrizePool = require('../build/PrizePool.json')
const RNGInterface = require('../build/RNGInterface.json')
const IERC20 = require('../build/IERC20.json')
const IERC721 = require('../build/IERC721.json')
const ControlledToken = require('../build/ControlledToken.json')
const Ticket = require('../build/Ticket.json')

const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')
const { AddressZero, Zero, One } = require('ethers').constants

const now = () => (new Date()).getTime() / 1000 | 0
const toWei = (val) => ethers.utils.parseEther('' + val)
const debug = require('debug')('ptv3:PeriodicPrizePool.test')

const FORWARDER = '0x5f48a3371df0F8077EC741Cc2eB31c84a4Ce332a'

let overrides = { gasLimit: 20000000 }

describe('MultipleWinners', function() {
  let wallet, wallet2, wallet3, wallet4

  let externalERC20Award, externalERC721Award

  let registry, comptroller, prizePool, prizeStrategy, token

  let ticket, sponsorship, rng, rngFeeToken

  let prizePeriodStart = now()
  let prizePeriodSeconds = 1000

  let creditLimitMantissa = 0.1
  let creditRateMantissa = creditLimitMantissa / prizePeriodSeconds

  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await buidler.ethers.getSigners()

    debug({
      wallet: wallet._address,
      wallet2: wallet2._address,
      wallet3: wallet3._address,
      wallet4: wallet4._address
    })

    debug('deploying registry...')
    registry = await deploy1820(wallet)

    debug('deploying protocol comptroller...')
    comptroller = await deployMockContract(wallet, TokenListenerInterface.abi, [], overrides)

    debug('mocking tokens...')
    token = await deployMockContract(wallet, IERC20.abi, overrides)
    prizePool = await deployMockContract(wallet, PrizePool.abi, overrides)
    ticket = await deployMockContract(wallet, Ticket.abi, overrides)
    sponsorship = await deployMockContract(wallet, ControlledToken.abi, overrides)
    rng = await deployMockContract(wallet, RNGInterface.abi, overrides)
    rngFeeToken = await deployMockContract(wallet, IERC20.abi, overrides)
    externalERC20Award = await deployMockContract(wallet, IERC20.abi, overrides)
    externalERC721Award = await deployMockContract(wallet, IERC721.abi, overrides)

    await rng.mock.getRequestFee.returns(rngFeeToken.address, toWei('1'));

    debug('deploying prizeStrategy...')
    prizeStrategy = await deployContract(wallet, MultipleWinnersHarness, [], overrides)

    await prizePool.mock.canAwardExternal.withArgs(externalERC20Award.address).returns(true)
    await prizePool.mock.canAwardExternal.withArgs(externalERC721Award.address).returns(true)

    // wallet 1 always wins
    await ticket.mock.draw.returns(wallet._address)

    debug('initializing prizeStrategy...')
    await prizeStrategy.initializeMultipleWinners(
      FORWARDER,
      prizePeriodStart,
      prizePeriodSeconds,
      prizePool.address,
      ticket.address,
      sponsorship.address,
      rng.address,
      4
    )

    debug('initialized!')
  })

  describe('initializeMultipleWinners()', () => {

    it('should emit event when initialized', async()=>{
      debug('deploying another prizeStrategy...')
      let prizeStrategy2 = await deployContract(wallet, MultipleWinnersHarness, [], overrides)
      initalizeResult2 = prizeStrategy2.initializeMultipleWinners(FORWARDER,
        prizePeriodStart,
        prizePeriodSeconds,
        prizePool.address,
        ticket.address,
        sponsorship.address,
        rng.address,
        4)

      await expect(initalizeResult2).to.emit(prizeStrategy2, 'NumberOfWinnersSet').withArgs(4)
    })


    it('should set the params', async () => {
      expect(await prizeStrategy.isTrustedForwarder(FORWARDER)).to.equal(true)
      expect(await prizeStrategy.prizePool()).to.equal(prizePool.address)
      expect(await prizeStrategy.prizePeriodSeconds()).to.equal(prizePeriodSeconds)
      expect(await prizeStrategy.ticket()).to.equal(ticket.address)
      expect(await prizeStrategy.sponsorship()).to.equal(sponsorship.address)
      expect(await prizeStrategy.rng()).to.equal(rng.address)
      expect(await prizeStrategy.numberOfWinners()).to.equal(4)
    })
  })

  describe('numberOfWinners()', () => {
    it('should return the number of winners', async () => {
      expect(await prizeStrategy.numberOfWinners()).to.equal(4)
    })
  })

  describe('setNumberOfWinners()', () => {
    it('should set the number of winners', async () => {
      await expect(prizeStrategy.setNumberOfWinners(10))
        .to.emit(prizeStrategy, 'NumberOfWinnersSet')
        .withArgs(10)
    })

    it('should not allow anyone else to call', async () => {
      await expect(prizeStrategy.connect(wallet2).setNumberOfWinners(10)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('should require at least one winner', async () => {
      await expect(prizeStrategy.setNumberOfWinners(0)).to.be.revertedWith("MultipleWinners/winners-gte-one")
    })
  })

  describe('distribute()', () => {
    it('should ignore awarding prizes if there are no winners to select', async () => {
      await prizePool.mock.captureAwardBalance.returns(toWei('10'))
      await ticket.mock.draw.withArgs(10).returns(ethers.constants.AddressZero)
      await expect(prizeStrategy.distribute(10))
        .to.emit(prizeStrategy, 'NoWinners')
    })

    it('should award a single winner', async () => {
      await prizeStrategy.setNumberOfWinners(1)

      let randomNumber = 10
      await prizePool.mock.captureAwardBalance.returns(toWei('8'))
      await ticket.mock.draw.withArgs(randomNumber).returns(wallet3._address)

      await externalERC20Award.mock.balanceOf.withArgs(prizePool.address).returns(0)

      await ticket.mock.totalSupply.returns(1000)

      await prizePool.mock.award.withArgs(wallet3._address, toWei('8'), ticket.address).returns()

      await prizeStrategy.distribute(randomNumber)
    })

    describe('with a real ticket contract', async () => {

      let controller, ticket

      beforeEach(async () => {
        controller = await deployMockContract(wallet, TokenControllerInterface.abi, overrides)
        await controller.mock.beforeTokenTransfer.returns()
        ticket = await deployContract(wallet, Ticket, [], overrides)
        await ticket.initialize("NAME", "SYMBOL", 8, ethers.constants.AddressZero, controller.address)

        await controller.call(ticket, 'controllerMint', wallet._address, toWei('100'))
        await controller.call(ticket, 'controllerMint', wallet2._address, toWei('100'))

        prizeStrategy = await deployContract(wallet, MultipleWinnersHarness, [], overrides)
        debug('initializing prizeStrategy 2...')
        await prizeStrategy.initializeMultipleWinners(
          FORWARDER,
          prizePeriodStart,
          prizePeriodSeconds,
          prizePool.address,
          ticket.address,
          sponsorship.address,
          rng.address,
          4
        )
        
      })

      it('should do nothing if there is no prize', async () => {
        await prizePool.mock.captureAwardBalance.returns(toWei('0'))

        await prizeStrategy.setNumberOfWinners(2)
        await prizeStrategy.distribute(92) // this hashes out to the same winner twice
      })

      it('may distribute to the same winner twice', async () => {
        await prizePool.mock.captureAwardBalance.returns(toWei('8'))
        await prizePool.mock.award.withArgs(wallet._address, toWei('4'), ticket.address).returns()

        await prizeStrategy.setNumberOfWinners(2)
        await prizeStrategy.distribute(92) // this hashes out to the same winner twice
      })

      it('should distribute to more than one winner', async () => {
        await prizePool.mock.captureAwardBalance.returns(toWei('9'))
        await prizePool.mock.award.withArgs(wallet._address, toWei('3'), ticket.address).returns()
        await prizePool.mock.award.withArgs(wallet2._address, toWei('3'), ticket.address).returns()

        await prizeStrategy.setNumberOfWinners(3)
        await prizeStrategy.distribute(90)
      })

      describe('when external erc20 awards are distributed', () => {

        beforeEach(async () => {
          await prizeStrategy.addExternalErc20Award(externalERC20Award.address)
        })

        it('should distribute all of the erc20 awards to the main winner', async () => {
          await prizePool.mock.captureAwardBalance.returns(toWei('0'))
          await externalERC20Award.mock.balanceOf.withArgs(prizePool.address).returns(toWei('8'))

          await prizePool.mock.awardExternalERC20.withArgs(wallet._address, externalERC20Award.address, toWei('8')).returns();

          await prizeStrategy.setNumberOfWinners(2)
          await prizeStrategy.distribute(92) // this hashes out to the same winner twice
        })

        it('should evenly distribute ERC20 awards if split is on', async () => {
          await prizePool.mock.captureAwardBalance.returns(toWei('0'))
          await externalERC20Award.mock.balanceOf.withArgs(prizePool.address).returns(toWei('9'))

          await prizePool.mock.awardExternalERC20.withArgs(wallet._address, externalERC20Award.address, toWei('3')).returns();
          await prizePool.mock.awardExternalERC20.withArgs(wallet2._address, externalERC20Award.address, toWei('3')).returns();

          await prizeStrategy.setSplitExternalErc20Awards(true)
          await prizeStrategy.setNumberOfWinners(3)
          await prizeStrategy.distribute(90) // this hashes out to the same winner twice
        })

        it('should do nothing if split is on and balance is zero', async () => {
          await prizePool.mock.captureAwardBalance.returns(toWei('0'))
          await externalERC20Award.mock.balanceOf.withArgs(prizePool.address).returns(toWei('0'))

          await prizeStrategy.setSplitExternalErc20Awards(true)
          await prizeStrategy.setNumberOfWinners(3)
          await prizeStrategy.distribute(90) // this hashes out to the same winner twice
        })

      })
    })
  })
})
