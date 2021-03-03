const { deployMockContract } = require('ethereum-waffle')
const { expect } = require('chai')
const hre = require('hardhat')
const { AddressZero } = require('ethers').constants

const toWei = (val) => ethers.utils.parseEther('' + val)

const debug = require('debug')('ptv3:SablierManager.test')

let overrides = { gasLimit: 9500000 }

describe('SablierManager', () => {
  let wallet, wallet2

  let sablierManager, sablier, prizePool, token

  let IERC20, ISablier, OwnableUpgradeable, PeriodicPrizeStrategy

  beforeEach(async () => {
    [wallet, wallet2] = await hre.ethers.getSigners()

    IERC20 = await hre.artifacts.readArtifact("IERC20Upgradeable")
    ISablier = await hre.artifacts.readArtifact("ISablier")
    OwnableUpgradeable = await hre.artifacts.readArtifact("OwnableUpgradeable")
    PeriodicPrizeStrategy = await hre.artifacts.readArtifact("PeriodicPrizeStrategy")

    token = await deployMockContract(wallet, IERC20.abi, overrides)
    prizePool = await deployMockContract(wallet, OwnableUpgradeable.abi, overrides)
    await prizePool.mock.owner.returns(wallet.address)
    sablier = await deployMockContract(wallet, ISablier.abi, overrides)

    const SablierManagerHarness =  await hre.ethers.getContractFactory("SablierManagerHarness", wallet, overrides)
    sablierManager = await SablierManagerHarness.deploy(sablier.address)
  })

  describe('cancelSablierStream()', () => {

    it('should do nothing if there is no stream', async () => {
      await expect(sablierManager.cancelSablierStream(prizePool.address))
        .not.to.emit(sablierManager, 'SablierStreamCancelled')
    })

    it('should cancel the stream id (check call)', async () => {
      await sablierManager.setSablierStreamId(prizePool.address, 1)

      // way of asserting that cancelStream is called
      await sablier.mock.cancelStream.withArgs(1).revertsWithReason("fail")

      await expect(sablierManager.cancelSablierStream(prizePool.address)).to.be.revertedWith("fail")
    })

    it('should cancel the stream id', async () => {
      await sablierManager.setSablierStreamId(prizePool.address, 1)

      await sablier.mock.cancelStream.withArgs(1).returns(true)

      await expect(sablierManager.cancelSablierStream(prizePool.address))
        .to.emit(sablierManager, 'SablierStreamCancelled')

      expect(await sablierManager.sablierStreamId(prizePool.address)).to.equal('0')
    })
  })

  describe('createSablierStream()', () => {
    it('should allow the owner to create a stream', async () => {

      let block = await ethers.provider.getBlock()
      let startTime = block.timestamp + 100
      let endTime = startTime + 100
      let deposit = toWei('100')

      await token.mock.transferFrom.withArgs(wallet.address, sablierManager.address, deposit).returns(true)
      await token.mock.approve.withArgs(sablier.address, deposit).returns(true)
      await sablier.mock.createStream.withArgs(prizePool.address, deposit, token.address, startTime, endTime).returns(14)
      
      await expect(sablierManager.createSablierStream(prizePool.address, deposit, token.address, startTime, endTime))
        .to.emit(sablierManager, 'SablierStreamCreated')
        .withArgs(14, prizePool.address)

      expect(await sablierManager.sablierStreamId(prizePool.address)).to.equal('14')
    })

    it('should only allow the owner to do so', async () => {
      await expect(sablierManager.connect(wallet2).createSablierStream(prizePool.address, 0, token.address, 0, 0)).to.be.revertedWith("SablierManager/caller-not-owner")
    })
  })

  describe('withdrawSablierStream()', () => {
    beforeEach(async () => {
      await sablier.mock.getStream.withArgs(1).returns(
        AddressZero,
        prizePool.address,
        '0',
        token.address,
        ethers.BigNumber.from('0'),
        ethers.BigNumber.from('1'),
        ethers.BigNumber.from('0'),
        ethers.BigNumber.from('0')
      )

      await sablierManager.setSablierStreamId(prizePool.address, 1)
    })

    it('should ignore if there is no stream', async () => {
      await sablierManager.setSablierStreamId(prizePool.address, 0)

      await expect(sablierManager.withdrawSablierStream(prizePool.address))
        .not.to.emit(sablierManager, 'SablierStreamWithdrawn')
    })

    it('should withdraw from the stream', async () => {
      await sablier.mock.balanceOf.withArgs(1, prizePool.address).returns(toWei('11'))
      await sablier.mock.withdrawFromStream.withArgs(1, toWei('11')).returns(true)
      await token.mock.transfer.withArgs(prizePool.address, toWei('11')).returns(true);
      
      await expect(sablierManager.withdrawSablierStream(prizePool.address))
        .to.emit(sablierManager, 'SablierStreamWithdrawn')
        .withArgs(1, toWei('11'))
    })

    it('should skip withdrawal if balance is zero', async () => {
      await sablier.mock.balanceOf.withArgs(1, prizePool.address).returns(toWei('0'))

      await expect(sablierManager.withdrawSablierStream(prizePool.address))
        .to.emit(sablierManager, 'SablierStreamWithdrawn')
        .withArgs(1, toWei('0'))
    })
  })

  describe('beforePrizePoolAwarded()', () => {
    let prizeStrategy

    beforeEach(async () => {
      prizeStrategy = await deployMockContract(wallet, PeriodicPrizeStrategy.abi, overrides)
      await prizeStrategy.mock.prizePool.returns(prizePool.address)
    })

    it('should withdraw the stream for the given prize pool', async () => {
      await sablierManager.setSablierStreamId(prizePool.address, 1)

      await sablier.mock.balanceOf.withArgs(1, prizePool.address).returns('99')
      await sablier.mock.withdrawFromStream.withArgs(1, '99').returns(true)

      await expect(prizeStrategy.call(sablierManager, "beforePrizePoolAwarded", 1234, 1))
        .to.emit(sablierManager, 'SablierStreamWithdrawn')
    })
  })
})
