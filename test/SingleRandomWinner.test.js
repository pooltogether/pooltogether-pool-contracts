const { deployMockContract } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')

const { expect } = require('chai')
const hardhat = require('hardhat')

const now = () => (new Date()).getTime() / 1000 | 0
const toWei = (val) => ethers.utils.parseEther('' + val)
const debug = require('debug')('ptv3:PeriodicPrizePool.test')

let overrides = { gasLimit: 9500000 }

describe('SingleRandomWinner', function() {
  let wallet, wallet2

  let externalERC20Award, externalERC721Award

  let registry, comptroller, prizePool, prizeStrategy, token

  let ticket, sponsorship, rng, rngFeeToken

  let prizePeriodStart = now()
  let prizePeriodSeconds = 1000

  let creditLimitMantissa = 0.1

  beforeEach(async () => {
    [wallet, wallet2, wallet3] = await hardhat.ethers.getSigners()

    debug(`using wallet ${wallet.address}`)

    debug('deploying registry...')
    registry = await deploy1820(wallet)

    debug('deploying protocol comptroller...')
    const TokenListenerInterface = await hre.artifacts.readArtifact("TokenListenerInterface")
    comptroller = await deployMockContract(wallet, TokenListenerInterface.abi, [], overrides)

    debug('mocking tokens...')

    const IERC20 = await hre.artifacts.readArtifact("IERC20Upgradeable")
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

    await rng.mock.getRequestFee.returns(rngFeeToken.address, toWei('1'));

    debug('deploying prizeStrategy...')

    const SingleRandomWinnerHarness =  await hre.ethers.getContractFactory("SingleRandomWinnerHarness", wallet, overrides)
    prizeStrategy = await SingleRandomWinnerHarness.deploy()

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

    debug('initialized!')
  })

  describe('distribute()', () => {
    it('should ignore awarding prizes if there are no winners to select', async () => {
      await prizePool.mock.captureAwardBalance.returns(toWei('10'))
      await ticket.mock.draw.withArgs(10).returns(ethers.constants.AddressZero)
      await expect(prizeStrategy.distribute(10))
        .to.emit(prizeStrategy, 'NoWinner')
    })

    it('should award a single winner', async () => {
      let randomNumber = 10
      await prizePool.mock.captureAwardBalance.returns(toWei('8'))
      await ticket.mock.draw.withArgs(randomNumber).returns(wallet3.address)

      await externalERC20Award.mock.balanceOf.withArgs(prizePool.address).returns(0)

      await ticket.mock.totalSupply.returns(1000)

      await prizePool.mock.award.withArgs(wallet3.address, toWei('8'), ticket.address).returns()

      await prizeStrategy.distribute(randomNumber)
    })
  })
})
