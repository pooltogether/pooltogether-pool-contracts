const { deployMockContract, deployContract } = require('ethereum-waffle')
const { call } = require('./helpers/call')
const { deploy1820 } = require('deploy-eip-1820')


const { expect } = require('chai')
const hre = require('hardhat')
const { AddressZero, One } = require('ethers').constants

const now = () => (new Date()).getTime() / 1000 | 0
const toWei = (val) => ethers.utils.parseEther('' + val)
const debug = require('debug')('ptv3:PeriodicPrizePool.test')

const SENTINEL = '0x0000000000000000000000000000000000000001'
const invalidExternalToken = '0x0000000000000000000000000000000000000002'

let overrides = { gasLimit: 9500000 }

describe('PeriodicPrizeStrategy', () => {
  let wallet, wallet2

  let externalERC20Award, externalERC721Award

  let registry, tokenListener, prizePool, prizeStrategy, token

  let ticket, sponsorship, rng, rngFeeToken

  let prizePeriodStart = now()
  let prizePeriodSeconds = 1000

  let periodicPrizeStrategyListener, distributor

  let IERC20, TokenListenerInterface, ISablier

  beforeEach(async () => {
    [wallet, wallet2] = await hre.ethers.getSigners()

    IERC20 = await hre.artifacts.readArtifact("IERC20Upgradeable")
    ISablier = await hre.artifacts.readArtifact("ISablier")
    TokenListenerInterface = await hre.artifacts.readArtifact("TokenListenerInterface")

    debug(`using wallet ${wallet.address}`)

    debug('deploying registry...')
    registry = await deploy1820(wallet)

    debug('deploying protocol tokenListener...')
    
    tokenListener = await deployMockContract(wallet, TokenListenerInterface.abi, [], overrides)

    await tokenListener.mock.supportsInterface.returns(true)
    await tokenListener.mock.supportsInterface.withArgs('0xffffffff').returns(false)

    debug('mocking tokens...')
    
    token = await deployMockContract(wallet, IERC20.abi, overrides)
    
    const PrizePool = await hre.artifacts.readArtifact("PrizePool")
    prizePool = await deployMockContract(wallet, PrizePool.abi, overrides)
    
    const Ticket = await hre.artifacts.readArtifact("Ticket")
    ticket = await deployMockContract(wallet, Ticket.abi, overrides)
    
    const ControlledToken = await hre.artifacts.readArtifact("ControlledToken")
    sponsorship = await deployMockContract(wallet, ControlledToken.abi, overrides)
    
    const RNGInterface = await hre.artifacts.readArtifact("RNGInterface")
    rng = await deployMockContract(wallet, RNGInterface.abi, overrides)
    
   
    rngFeeToken = await deployMockContract(wallet, IERC20.abi, overrides)
    
    
    externalERC20Award = await deployMockContract(wallet, IERC20.abi, overrides)
    
    const IERC721 = await hre.artifacts.readArtifact("IERC721Upgradeable")
    externalERC721Award = await deployMockContract(wallet, IERC721.abi, overrides)
    
    const PeriodicPrizeStrategyDistributorInterface = await hre.artifacts.readArtifact("PeriodicPrizeStrategyDistributorInterface")
    distributor = await deployMockContract(wallet, PeriodicPrizeStrategyDistributorInterface.abi, overrides)
    
    const PeriodicPrizeStrategyListenerInterface = await hre.artifacts.readArtifact("PeriodicPrizeStrategyListenerInterface")
    periodicPrizeStrategyListener = await deployMockContract(wallet, PeriodicPrizeStrategyListenerInterface.abi, overrides)
    
    await externalERC721Award.mock.supportsInterface.returns(true)
    await externalERC721Award.mock.supportsInterface.withArgs('0xffffffff').returns(false)

    await periodicPrizeStrategyListener.mock.supportsInterface.returns(true)
    await periodicPrizeStrategyListener.mock.supportsInterface.withArgs('0xffffffff').returns(false)

    await rng.mock.getRequestFee.returns(rngFeeToken.address, toWei('1'));

    debug('deploying prizeStrategy...')
    const PeriodicPrizeStrategyHarness =  await hre.ethers.getContractFactory("PeriodicPrizeStrategyHarness", wallet, overrides)
    prizeStrategy = await PeriodicPrizeStrategyHarness.deploy()
    await prizeStrategy.setDistributor(distributor.address)

    await prizePool.mock.canAwardExternal.withArgs(externalERC20Award.address).returns(true)
    await prizePool.mock.canAwardExternal.withArgs(externalERC721Award.address).returns(true)

    // wallet 1 always wins
    await ticket.mock.draw.returns(wallet.address)

    debug('initializing prizeStrategy...')
    await prizeStrategy.initialize(
      prizePeriodStart,
      prizePeriodSeconds,
      prizePool.address,
      ticket.address,
      sponsorship.address,
      rng.address,
      []
    )

    await externalERC20Award.mock.totalSupply.returns(0)
    await prizeStrategy.addExternalErc20Award(externalERC20Award.address)

    debug('initialized!')
  })

  describe('initialize()', () => {
    it('should emit an Initialized event', async () => {
      debug('deploying another prizeStrategy...')
      const PeriodicPrizeStrategyHarness =  await hre.ethers.getContractFactory("PeriodicPrizeStrategyHarness", wallet, overrides)
 
      let prizeStrategy2 = await PeriodicPrizeStrategyHarness.deploy()
      await prizeStrategy2.setDistributor(distributor.address)
      initalizeResult2 = prizeStrategy2.initialize(
        prizePeriodStart,
        prizePeriodSeconds,
        prizePool.address,
        ticket.address,
        sponsorship.address,
        rng.address,
        []
      )

      await expect(initalizeResult2).to.emit(prizeStrategy2, 'Initialized').withArgs(
        prizePeriodStart,
        prizePeriodSeconds,
        prizePool.address,
        ticket.address,
        sponsorship.address,
        rng.address,
        []
      )
    })

    it('should set the params', async () => {
      expect(await prizeStrategy.prizePool()).to.equal(prizePool.address)
      expect(await prizeStrategy.prizePeriodSeconds()).to.equal(prizePeriodSeconds)
      expect(await prizeStrategy.ticket()).to.equal(ticket.address)
      expect(await prizeStrategy.sponsorship()).to.equal(sponsorship.address)
      expect(await prizeStrategy.rng()).to.equal(rng.address)

    })

    it('should reject invalid params', async () => {
      const _initArgs = [
        prizePeriodStart,
        prizePeriodSeconds,
        prizePool.address,
        ticket.address,
        sponsorship.address,
        rng.address,
        []
      ]
      let initArgs

      debug('deploying secondary prizeStrategy...')
      const PeriodicPrizeStrategyHarness =  await hre.ethers.getContractFactory("PeriodicPrizeStrategyHarness", wallet, overrides)

      const prizeStrategy2 = await PeriodicPrizeStrategyHarness.deploy()

      debug('testing initialization of secondary prizeStrategy...')

      initArgs = _initArgs.slice(); initArgs[1] = 0
      await expect(prizeStrategy2.initialize(...initArgs)).to.be.revertedWith('PeriodicPrizeStrategy/prize-period-greater-than-zero')
      initArgs = _initArgs.slice(); initArgs[2] = AddressZero
      await expect(prizeStrategy2.initialize(...initArgs)).to.be.revertedWith('PeriodicPrizeStrategy/prize-pool-not-zero')
      initArgs = _initArgs.slice(); initArgs[3] = AddressZero
      await expect(prizeStrategy2.initialize(...initArgs)).to.be.revertedWith('PeriodicPrizeStrategy/ticket-not-zero')
      initArgs = _initArgs.slice(); initArgs[4] = AddressZero
      await expect(prizeStrategy2.initialize(...initArgs)).to.be.revertedWith('PeriodicPrizeStrategy/sponsorship-not-zero')
      initArgs = _initArgs.slice(); initArgs[5] = AddressZero
      await expect(prizeStrategy2.initialize(...initArgs)).to.be.revertedWith('PeriodicPrizeStrategy/rng-not-zero')

    })
  })

  describe('estimateRemainingBlocksToPrize()', () => {
    it('should estimate using the constant', async () => {
      let ppr = await prizeStrategy.prizePeriodRemainingSeconds()
      let blocks = parseInt(ppr.toNumber() / 14)
      expect(await prizeStrategy.estimateRemainingBlocksToPrize(toWei('14'))).to.equal(blocks)
    })
  })

  describe('currentPrize()', () => {
    it('should return the currently accrued interest when reserve is zero', async () => {
      await prizePool.mock.awardBalance.returns('100')
      expect(await call(prizeStrategy, 'currentPrize')).equal('100')
    })
  })

  describe('prizePeriodRemainingSeconds()', () => {
    it('should calculate the remaining seconds of the prize period', async () => {
      const startTime = await prizeStrategy.prizePeriodStartedAt()
      const halfTime = prizePeriodSeconds / 2
      const overTime = prizePeriodSeconds + 1

      // Half-time
      await prizeStrategy.setCurrentTime(startTime.add(halfTime))
      expect(await prizeStrategy.prizePeriodRemainingSeconds()).to.equal(halfTime)

      // Over-time
      await prizeStrategy.setCurrentTime(startTime.add(overTime))
      expect(await prizeStrategy.prizePeriodRemainingSeconds()).to.equal(0)
    })
  })

  describe('isPrizePeriodOver()', () => {
    it('should determine if the prize-period is over', async () => {
      const startTime = await prizeStrategy.prizePeriodStartedAt()
      const halfTime = prizePeriodSeconds / 2
      const overTime = prizePeriodSeconds + 1

      // Half-time
      await prizeStrategy.setCurrentTime(startTime.add(halfTime))
      expect(await prizeStrategy.isPrizePeriodOver()).to.equal(false)

      // Over-time
      await prizeStrategy.setCurrentTime(startTime.add(overTime))
      expect(await prizeStrategy.isPrizePeriodOver()).to.equal(true)
    })
  })

  describe('setRngService', () => {
    it('should only allow the owner to change it', async () => {
      await expect(prizeStrategy.setRngService(token.address))
        .to.emit(prizeStrategy, 'RngServiceUpdated')
        .withArgs(token.address)
    })

    it('should not allow anyone but the owner to change', async () => {
      prizeStrategy2 = prizeStrategy.connect(wallet2)
      await expect(prizeStrategy2.setRngService(token.address)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('should not be called if an rng request is in flight', async () => {
      await rngFeeToken.mock.approve.withArgs(rng.address, toWei('1')).returns(true);
      await rng.mock.requestRandomNumber.returns('11', '1');
      await prizeStrategy.setCurrentTime(await prizeStrategy.prizePeriodEndAt());
      await prizeStrategy.startAward();

      await expect(prizeStrategy.setRngService(token.address))
        .to.be.revertedWith('PeriodicPrizeStrategy/rng-in-flight');
    });
  })

  describe('cancelAward()', () => {
    it('should not allow anyone to cancel if the rng has not timed out', async () => {
      await expect(prizeStrategy.cancelAward()).to.be.revertedWith("PeriodicPrizeStrategy/rng-not-timedout")
    })

    it('should allow anyone to reset the rng if it times out', async () => {
      await rngFeeToken.mock.approve.withArgs(rng.address, toWei('1')).returns(true);
      await rng.mock.requestRandomNumber.returns('11', '1');
      await prizeStrategy.setCurrentTime(await prizeStrategy.prizePeriodEndAt());

      await prizeStrategy.startAward()

      // set it beyond request timeout
      await prizeStrategy.setCurrentTime((await prizeStrategy.prizePeriodEndAt()).add(await prizeStrategy.rngRequestTimeout()).add(1));

      // should be timed out
      expect(await prizeStrategy.isRngTimedOut()).to.be.true

      await expect(prizeStrategy.cancelAward())
        .to.emit(prizeStrategy, 'PrizePoolAwardCancelled')
        .withArgs(wallet.address, prizePool.address, 11, 1)
    })
  })

  describe("beforeTokenTransfer()", () => {
    it('should not allow users to transfer tokens to themselves', async () => {
      await expect(prizePool.call(
        prizeStrategy,
        'beforeTokenTransfer(address,address,uint256,address)',
        wallet.address,
        wallet.address,
        toWei('10'),
        wallet.address
      )).to.be.revertedWith("PeriodicPrizeStrategy/transfer-to-self")
    })

    it('should allow other token transfers if awarding is happening', async () => {
      await rngFeeToken.mock.approve.withArgs(rng.address, toWei('1')).returns(true);
      await rng.mock.requestRandomNumber.returns('11', '1');
      await prizeStrategy.setCurrentTime(await prizeStrategy.prizePeriodEndAt());
      await prizeStrategy.startAward();

      await prizePool.call(
        prizeStrategy,
        'beforeTokenTransfer(address,address,uint256,address)',
        wallet.address,
        wallet2.address,
        toWei('10'),
        wallet.address
      )
    })

    it('should revert on ticket transfer if awarding is happening', async () => {
      await rngFeeToken.mock.approve.withArgs(rng.address, toWei('1')).returns(true);
      await rng.mock.requestRandomNumber.returns('11', '1');
      await prizeStrategy.setCurrentTime(await prizeStrategy.prizePeriodEndAt());
      await prizeStrategy.startAward();

      await expect(
        prizePool.call(
          prizeStrategy,
          'beforeTokenTransfer(address,address,uint256,address)',
          wallet.address,
          wallet2.address,
          toWei('10'),
          ticket.address
        ))
        .to.be.revertedWith('PeriodicPrizeStrategy/rng-in-flight')
    })
  })

  describe('getExternalErc20Awards()', () => {
    it('should allow anyone to retrieve the list of external ERC20 tokens attached to the prize', async () => {
      expect(await prizeStrategy.connect(wallet2).getExternalErc20Awards())
        .to.deep.equal([externalERC20Award.address])
    })
  })

  describe('addExternalErc20Award()', () => {
    it('should allow the owner to add external ERC20 tokens to the prize', async () => {
      const externalAward = await deployMockContract(wallet2, IERC20.abi, overrides)
      await externalAward.mock.totalSupply.returns(0)
      await prizePool.mock.canAwardExternal.withArgs(externalAward.address).returns(true)

      await expect(prizeStrategy.addExternalErc20Award(externalAward.address))
        .to.emit(prizeStrategy, 'ExternalErc20AwardAdded')
        .withArgs(externalAward.address)
    })

    it('should disallow unapproved external ERC20 prize tokens', async () => {
      const invalidExternalErc20 = await deployMockContract(wallet2, IERC20.abi, overrides)
      await invalidExternalErc20.mock.totalSupply.returns(0)
      await prizePool.mock.canAwardExternal.withArgs(invalidExternalErc20.address).returns(false)
      await expect(prizeStrategy.addExternalErc20Award(invalidExternalErc20.address))
        .to.be.revertedWith('PeriodicPrizeStrategy/cannot-award-external')
    })

    it('should disallow added EOA accounts', async () => {
      await expect(prizeStrategy.addExternalErc20Award(invalidExternalToken))
        .to.be.revertedWith('PeriodicPrizeStrategy/erc20-null')
    })

    it('should disallow contracts that are not erc20s', async () => {
      await prizePool.mock.canAwardExternal.withArgs(prizeStrategy.address).returns(true)
      await expect(prizeStrategy.addExternalErc20Award(prizeStrategy.address))
        .to.be.revertedWith('PeriodicPrizeStrategy/erc20-invalid')
    })

    it('should allow the listeners to add external erc20s', async () => {
      const externalAward = await deployMockContract(wallet2, IERC20.abi, overrides)
      await externalAward.mock.totalSupply.returns(0)
      await prizePool.mock.canAwardExternal.withArgs(externalAward.address).returns(true)

      const BeforeAwardListener = await hre.artifacts.readArtifact("BeforeAwardListener")
      const beforeAwardListener = await deployMockContract(wallet, BeforeAwardListener.abi, overrides)
      await prizeStrategy.forceBeforeAwardListener(beforeAwardListener.address)

      await expect(beforeAwardListener.call(prizeStrategy, 'addExternalErc20Award', externalAward.address))
        .to.emit(prizeStrategy, 'ExternalErc20AwardAdded')
        .withArgs(externalAward.address)
    })
  })

  describe('removeExternalErc20Award()', () => {
    it('should only allow the owner to remove external ERC20 tokens from the prize', async () => {
      await expect(prizeStrategy.removeExternalErc20Award(externalERC20Award.address, SENTINEL))
        .to.emit(prizeStrategy, 'ExternalErc20AwardRemoved')
        .withArgs(externalERC20Award.address)
    })
    it('should revert when removing non-existant external ERC20 tokens from the prize', async () => {
      await expect(prizeStrategy.removeExternalErc20Award(invalidExternalToken, SENTINEL))
        .to.be.revertedWith('Invalid prevAddress')
    })
    it('should not allow anyone else to remove external ERC20 tokens from the prize', async () => {
      await expect(prizeStrategy.connect(wallet2).removeExternalErc20Award(externalERC20Award.address, SENTINEL))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('getExternalErc721Awards()', () => {
    it('should allow anyone to retrieve the list of external ERC721 tokens attached to the prize', async () => {
      await externalERC721Award.mock.ownerOf.withArgs(1).returns(prizePool.address)
      await prizeStrategy.addExternalErc721Award(externalERC721Award.address, [1])

      expect(await prizeStrategy.connect(wallet2).getExternalErc721Awards())
        .to.deep.equal([externalERC721Award.address])

      expect(await prizeStrategy.connect(wallet2).getExternalErc721AwardTokenIds(externalERC721Award.address))
        .to.deep.equal([One])
    })
  })

  describe('addExternalErc20Awards()', () => {
    it('should allow the owner to add external ERC20 tokens to the prize', async () => {
      const externalAward = await deployMockContract(wallet2, IERC20.abi, overrides)
      const externalAward2 = await deployMockContract(wallet2, IERC20.abi, overrides)
      await externalAward.mock.totalSupply.returns(0)
      await externalAward2.mock.totalSupply.returns(0)
      await prizePool.mock.canAwardExternal.withArgs(externalAward.address).returns(true)
      await prizePool.mock.canAwardExternal.withArgs(externalAward2.address).returns(true)
      await expect(prizeStrategy.addExternalErc20Awards([externalAward.address, externalAward2.address]))
        .to.emit(prizeStrategy, 'ExternalErc20AwardAdded')
        .withArgs(externalAward.address)
    })

    it('should not allow anyone else to add', async () => {
      await expect(prizeStrategy.connect(wallet2).addExternalErc20Awards([externalERC20Award.address]))
        .to.be.revertedWith('PeriodicPrizeStrategy/only-owner-or-listener')
    })
  })

  describe('addExternalErc721Award()', () => {
    it('should allow the owner to add external ERC721 tokens to the prize', async () => {
      await externalERC721Award.mock.ownerOf.withArgs(1).returns(prizePool.address)
      await expect(prizeStrategy.addExternalErc721Award(externalERC721Award.address, [1]))
        .to.emit(prizeStrategy, 'ExternalErc721AwardAdded')
        .withArgs(externalERC721Award.address, [1])
    })

    it('should allow adding multiple erc721s to the prize', async () => {
      await externalERC721Award.mock.ownerOf.withArgs(1).returns(prizePool.address)
      await externalERC721Award.mock.ownerOf.withArgs(2).returns(prizePool.address)
      await expect(prizeStrategy.addExternalErc721Award(externalERC721Award.address, [1]))
        .to.emit(prizeStrategy, 'ExternalErc721AwardAdded')
        .withArgs(externalERC721Award.address, [1])
      await expect(prizeStrategy.addExternalErc721Award(externalERC721Award.address, [2]))
        .to.emit(prizeStrategy, 'ExternalErc721AwardAdded')
        .withArgs(externalERC721Award.address, [2])
    })

    it('should disallow unapproved external ERC721 prize tokens', async () => {
      await prizePool.mock.canAwardExternal.withArgs(invalidExternalToken).returns(false)
      await expect(prizeStrategy.addExternalErc721Award(invalidExternalToken, [1]))
        .to.be.revertedWith('PeriodicPrizeStrategy/cannot-award-external')
    })

    it('should disallow ERC721 tokens that are not held by the Prize Pool', async () => {
      await externalERC721Award.mock.ownerOf.withArgs(1).returns(wallet.address)
      await expect(prizeStrategy.addExternalErc721Award(externalERC721Award.address, [1]))
        .to.be.revertedWith('PeriodicPrizeStrategy/unavailable-token')
    })

    it('should disallow anyone but the owner or listener', async () => {
      await expect(prizeStrategy.connect(wallet2).addExternalErc721Award(externalERC721Award.address, [1]))
        .to.be.revertedWith('PeriodicPrizeStrategy/only-owner-or-listener')
    })

    it('should not allow someone to add a token twice', async () => {
      await externalERC721Award.mock.ownerOf.withArgs(1).returns(prizePool.address)
      await expect(prizeStrategy.addExternalErc721Award(externalERC721Award.address, [1, 1]))
        .to.be.revertedWith('PeriodicPrizeStrategy/erc721-duplicate')
    })

    it('should not allow someone to add a non-ERC721 contract', async () => {
      await prizePool.mock.canAwardExternal.withArgs(prizePool.address).returns(true)
      await expect(prizeStrategy.addExternalErc721Award(prizePool.address, [1]))
        .to.be.revertedWith('PeriodicPrizeStrategy/erc721-invalid')
    })
  })

  describe('removeExternalErc721Award()', () => {
    it('should only allow the owner to remove external ERC721 tokens from the prize', async () => {
      await externalERC721Award.mock.ownerOf.withArgs(1).returns(prizePool.address)
      await prizeStrategy.addExternalErc721Award(externalERC721Award.address, [1])
      await expect(prizeStrategy.removeExternalErc721Award(externalERC721Award.address, SENTINEL))
        .to.emit(prizeStrategy, 'ExternalErc721AwardRemoved')
        .withArgs(externalERC721Award.address)
    })
    it('should revert when removing non-existant external ERC721 tokens from the prize', async () => {
      await expect(prizeStrategy.removeExternalErc721Award(invalidExternalToken, SENTINEL))
        .to.be.revertedWith('Invalid prevAddress')
    })
    it('should not allow anyone else to remove external ERC721 tokens from the prize', async () => {
      await expect(prizeStrategy.connect(wallet2).removeExternalErc721Award(externalERC721Award.address, SENTINEL))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('canStartAward()', () => {
    it('should determine if a prize is able to be awarded', async () => {
      const startTime = await prizeStrategy.prizePeriodStartedAt()

      // Prize-period not over, RNG not requested
      await prizeStrategy.setCurrentTime(startTime.add(10))
      await prizeStrategy.setRngRequest(0, 0)
      expect(await prizeStrategy.canStartAward()).to.equal(false)

      // Prize-period not over, RNG requested
      await prizeStrategy.setCurrentTime(startTime.add(10))
      await prizeStrategy.setRngRequest(1, 100)
      expect(await prizeStrategy.canStartAward()).to.equal(false)

      // Prize-period over, RNG requested
      await prizeStrategy.setCurrentTime(startTime.add(prizePeriodSeconds))
      await prizeStrategy.setRngRequest(1, 100)
      expect(await prizeStrategy.canStartAward()).to.equal(false)

      // Prize-period over, RNG not requested
      await prizeStrategy.setCurrentTime(startTime.add(prizePeriodSeconds))
      await prizeStrategy.setRngRequest(0, 0)
      expect(await prizeStrategy.canStartAward()).to.equal(true)
    })
  })

  describe('canCompleteAward()', () => {
    it('should determine if a prize is able to be completed', async () => {
      // RNG not requested, RNG not completed
      await prizeStrategy.setRngRequest(0, 0)
      await rng.mock.isRequestComplete.returns(false)
      expect(await prizeStrategy.canCompleteAward()).to.equal(false)

      // RNG requested, RNG not completed
      await prizeStrategy.setRngRequest(1, 100)
      await rng.mock.isRequestComplete.returns(false)
      expect(await prizeStrategy.canCompleteAward()).to.equal(false)

      // RNG requested, RNG completed
      await prizeStrategy.setRngRequest(1, 100)
      await rng.mock.isRequestComplete.returns(true)
      expect(await prizeStrategy.canCompleteAward()).to.equal(true)
    })
  })

  describe('getLastRngLockBlock()', () => {
    it('should return the lock-block for the last RNG request', async () => {
      await prizeStrategy.setRngRequest(0, 0)
      expect(await prizeStrategy.getLastRngLockBlock()).to.equal(0)

      await prizeStrategy.setRngRequest(1, 123)
      expect(await prizeStrategy.getLastRngLockBlock()).to.equal(123)
    })
  })

  describe('getLastRngRequestId()', () => {
    it('should return the Request ID for the last RNG request', async () => {
      await prizeStrategy.setRngRequest(0, 0)
      expect(await prizeStrategy.getLastRngRequestId()).to.equal(0)

      await prizeStrategy.setRngRequest(1, 123)
      expect(await prizeStrategy.getLastRngRequestId()).to.equal(1)
    })
  })

  describe('setBeforeAwardListener()', () => {
    let beforeAwardListener

    beforeEach(async () => {
      const beforeAwardListenerStub = await hre.ethers.getContractFactory("BeforeAwardListenerStub")
      beforeAwardListener = await beforeAwardListenerStub.deploy()
    })

    it('should allow the owner to change the listener', async () => {
      await expect(prizeStrategy.setBeforeAwardListener(beforeAwardListener.address))
        .to.emit(prizeStrategy, 'BeforeAwardListenerSet')
        .withArgs(beforeAwardListener.address)
    })

    it('should not allow anyone else to set it', async () => {
      await expect(prizeStrategy.connect(wallet2).setBeforeAwardListener(beforeAwardListener.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('should not allow setting an EOA as a listener', async () => {
      await expect(prizeStrategy.setBeforeAwardListener(wallet2.address))
        .to.be.revertedWith("PeriodicPrizeStrategy/beforeAwardListener-invalid");
    })

    it('should allow setting the listener to null', async () => {
      await expect(prizeStrategy.setBeforeAwardListener(ethers.constants.AddressZero))
        .to.emit(prizeStrategy, 'BeforeAwardListenerSet')
        .withArgs(ethers.constants.AddressZero)
    })
  })

  describe('setPeriodicPrizeStrategyListener()', () => {
    it('should allow the owner to change the listener', async () => {
      await expect(prizeStrategy.setPeriodicPrizeStrategyListener(periodicPrizeStrategyListener.address))
        .to.emit(prizeStrategy, 'PeriodicPrizeStrategyListenerSet')
        .withArgs(periodicPrizeStrategyListener.address)
    })

    it('should not allow anyone else to set it', async () => {
      await expect(prizeStrategy.connect(wallet2).setPeriodicPrizeStrategyListener(periodicPrizeStrategyListener.address))
        .to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('should not allow setting an EOA as a listener', async () => {
      await expect(prizeStrategy.setPeriodicPrizeStrategyListener(wallet2.address))
        .to.be.revertedWith("PeriodicPrizeStrategy/prizeStrategyListener-invalid");
    })

    it('should allow setting the listener to null', async () => {
      await expect(prizeStrategy.setPeriodicPrizeStrategyListener(ethers.constants.AddressZero))
        .to.emit(prizeStrategy, 'PeriodicPrizeStrategyListenerSet')
        .withArgs(ethers.constants.AddressZero)
    })
  })

  describe('setTokenListener()', () => {
    it('should allow the owner to change the listener', async () => {
      await expect(prizeStrategy.setTokenListener(tokenListener.address))
        .to.emit(prizeStrategy, 'TokenListenerUpdated')
        .withArgs(tokenListener.address)
    })

    it('should not allow anyone else to change the listener', async () => {
      await expect(prizeStrategy.connect(wallet2).setTokenListener(tokenListener.address))
        .to.be.revertedWith("Ownable: caller is not the owner")
    })

    it('should not allow setting an EOA as a listener', async () => {
      await expect(prizeStrategy.setTokenListener(wallet2.address))
        .to.be.revertedWith("PeriodicPrizeStrategy/token-listener-invalid");
    })

    it('should allow setting the listener to null', async () => {
      await expect(prizeStrategy.setTokenListener(ethers.constants.AddressZero))
        .to.emit(prizeStrategy, 'TokenListenerUpdated')
        .withArgs(ethers.constants.AddressZero)
    })
  })

  describe('completeAward()', () => {
    it('should award the winner', async () => {
      debug('Setting time')

      await distributor.mock.distribute.withArgs('48849787646992769944319009300540211125598274780817112954146168253338351566848').returns()

      await prizeStrategy.setPeriodicPrizeStrategyListener(periodicPrizeStrategyListener.address)
      await periodicPrizeStrategyListener.mock.afterPrizePoolAwarded.withArgs('48849787646992769944319009300540211125598274780817112954146168253338351566848', await prizeStrategy.prizePeriodStartedAt()).returns()

      // no external award
      await externalERC20Award.mock.balanceOf.withArgs(prizePool.address).returns('0')

      // ensure prize period is over
      await prizeStrategy.setCurrentTime(await prizeStrategy.prizePeriodEndAt());

      // allow an rng request
      await rngFeeToken.mock.approve.withArgs(rng.address, toWei('1')).returns(true);
      await rng.mock.requestRandomNumber.returns('1', '1')

      debug('Starting award...')

      // start the award
      await prizeStrategy.startAward()

      // rng is done
      await rng.mock.isRequestComplete.returns(true)
      await rng.mock.randomNumber.returns('0x6c00000000000000000000000000000000000000000000000000000000000000')
      
      // draw winner
      await ticket.mock.totalSupply.returns(toWei('10'))

      // 1 dai to give
      await prizePool.mock.captureAwardBalance.returns(toWei('1'))
      // no reserve
      await prizePool.mock.calculateReserveFee.returns('0')
      await prizePool.mock.award.withArgs(wallet.address, toWei('1'), ticket.address).returns()

      debug('Completing award...')

      let startedAt = await prizeStrategy.prizePeriodStartedAt();

      // complete the award
      await prizeStrategy.completeAward()

      expect(await prizeStrategy.prizePeriodStartedAt()).to.equal(startedAt.add(prizePeriodSeconds))
    })
  })

  describe('calculateNextPrizePeriodStartTime()', () => {
    it('should always sync to the last period start time', async () => {
      let startedAt = await prizeStrategy.prizePeriodStartedAt();
      expect(await prizeStrategy.calculateNextPrizePeriodStartTime(startedAt.add(prizePeriodSeconds * 14))).to.equal(startedAt.add(prizePeriodSeconds * 14))
    })

    it('should return the current if it is within', async () => {
      let startedAt = await prizeStrategy.prizePeriodStartedAt();
      expect(await prizeStrategy.calculateNextPrizePeriodStartTime(startedAt.add(prizePeriodSeconds / 2))).to.equal(startedAt)
    })

    it('should return the next if it is after', async () => {
      let startedAt = await prizeStrategy.prizePeriodStartedAt();
      expect(await prizeStrategy.calculateNextPrizePeriodStartTime(startedAt.add(parseInt(prizePeriodSeconds * 1.5)))).to.equal(startedAt.add(prizePeriodSeconds))
    })
  })

  describe('setPrizePeriodSeconds()', () => {
    it('should allow the owner to set the prize period', async () => {
      await expect(prizeStrategy.setPrizePeriodSeconds(99))
        .to.emit(prizeStrategy, 'PrizePeriodSecondsUpdated')
        .withArgs(99)

      expect(await prizeStrategy.prizePeriodSeconds()).to.equal(99)
    })

    it('should not allow non-owners to set the prize period', async () => {
      await expect(prizeStrategy.connect(wallet2).setPrizePeriodSeconds(99)).to.be.revertedWith("Ownable: caller is not the owner")
    })
  })

  describe('with a prize-period scheduled in the future', () => {
    let prizeStrategy2

    beforeEach(async () => {
      prizePeriodStart = 10000

      debug('deploying secondary prizeStrategy...')
      const PeriodicPrizeStrategyHarness =  await hre.ethers.getContractFactory("PeriodicPrizeStrategyHarness", wallet, overrides)

      prizeStrategy2 = await PeriodicPrizeStrategyHarness.deploy()

      debug('initializing secondary prizeStrategy...')
      await prizeStrategy2.initialize(
        prizePeriodStart,
        prizePeriodSeconds,
        prizePool.address,
        ticket.address,
        sponsorship.address,
        rng.address,
        []
      )

      debug('initialized!')
    })

    describe('startAward()', () => {
      it('should prevent starting an award', async () => {
        await prizeStrategy2.setCurrentTime(100);
        await expect(prizeStrategy2.startAward()).to.be.revertedWith('PeriodicPrizeStrategy/prize-period-not-over')
      })
    })

    describe('completeAward()', () => {
      it('should prevent completing an award', async () => {
        await prizeStrategy2.setCurrentTime(100);
        await expect(prizeStrategy2.startAward()).to.be.revertedWith('PeriodicPrizeStrategy/prize-period-not-over')
      })
    })

  })
})
