const { deployMockContract } = require('ethereum-waffle')
const { deploy1820 } = require('deploy-eip-1820')


const { expect } = require('chai')
const hardhat = require('hardhat')
const { AddressZero, Zero, One } = require('ethers').constants

const now = () => (new Date()).getTime() / 1000 | 0
const toWei = (val) => ethers.utils.parseEther('' + val)
const debug = require('debug')('ptv3:PeriodicPrizePool.test')

let overrides = { gasLimit: 9500000 }

describe('MultipleWinners', function() {
  let wallet, wallet2, wallet3, wallet4

  let externalERC20Award, externalERC721Award

  let registry, comptroller, prizePool, prizeStrategy, token

  let ticket, sponsorship, rng, rngFeeToken

  let prizePeriodStart = now()
  let prizePeriodSeconds = 1000

  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await hardhat.ethers.getSigners()

    debug({
      wallet: wallet.address,
      wallet2: wallet2.address,
      wallet3: wallet3.address,
      wallet4: wallet4.address
    })

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
    const MultipleWinnersHarness =  await hre.ethers.getContractFactory("MultipleWinnersHarness", wallet, overrides)
  
    prizeStrategy = await MultipleWinnersHarness.deploy()

    await prizePool.mock.canAwardExternal.withArgs(externalERC20Award.address).returns(true)
    await prizePool.mock.canAwardExternal.withArgs(externalERC721Award.address).returns(true)

    // wallet 1 always wins
    await ticket.mock.draw.returns(wallet.address)

    debug('initializing prizeStrategy...')
    await prizeStrategy.initializeMultipleWinners(
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
      const MultipleWinnersHarness =  await hre.ethers.getContractFactory("MultipleWinnersHarness", wallet, overrides)
  
      let prizeStrategy2 = await MultipleWinnersHarness.deploy()
      initalizeResult2 = prizeStrategy2.initializeMultipleWinners(
        prizePeriodStart,
        prizePeriodSeconds,
        prizePool.address,
        ticket.address,
        sponsorship.address,
        rng.address,
        4
      )

      await expect(initalizeResult2).to.emit(prizeStrategy2, 'NumberOfWinnersSet').withArgs(4)
    })


    it('should set the params', async () => {
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

  describe('setBlocklisted()', () => {
    it('should block an address', async () => {
      await expect(prizeStrategy.setBlocklisted(wallet4.address, true))
        .to.emit(prizeStrategy, 'BlocklistSet')
        .withArgs(wallet4.address, true)
    })

    it('should block and unblock an address', async () => {
      await expect(prizeStrategy.setBlocklisted(wallet4.address, true))
        .to.emit(prizeStrategy, 'BlocklistSet')
        .withArgs(wallet4.address, true)
      
        await expect(prizeStrategy.setBlocklisted(wallet4.address, false))
        .to.emit(prizeStrategy, 'BlocklistSet')
        .withArgs(wallet4.address, false)
    })
  })

  describe('setCarryBlocklist()', () => {
    it('should enable carrying over the prize if not distributed', async () => {
      await expect(prizeStrategy.setCarryBlocklist(true))
        .to.emit(prizeStrategy, 'BlocklistCarrySet')
        .withArgs(true)
    })
    
    it('should block and unblock an address', async () => {
      await expect(prizeStrategy.setCarryBlocklist(true))
        .to.emit(prizeStrategy, 'BlocklistCarrySet')
        .withArgs(true)
      
        await expect(prizeStrategy.setCarryBlocklist(false))
        .to.emit(prizeStrategy, 'BlocklistCarrySet')
        .withArgs(false)
    })
  })
  
  describe('setBlocklistRetryCount()', () => {
    it('should set the retry the count', async () => {
      await expect(prizeStrategy.setBlocklistRetryCount(15))
        .to.emit(prizeStrategy, 'BlocklistRetryCountSet')
        .withArgs(15)
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
      await ticket.mock.totalSupply.returns(0)
      await expect(prizeStrategy.distribute(10))
        .to.emit(prizeStrategy, 'NoWinners')
    })

    it('should award a single winner', async () => {
      await prizeStrategy.setNumberOfWinners(1)

      let randomNumber = 10
      await prizePool.mock.captureAwardBalance.returns(toWei('8'))
      await ticket.mock.draw.withArgs(randomNumber).returns(wallet3.address)

      await externalERC20Award.mock.balanceOf.withArgs(prizePool.address).returns(0)

      await ticket.mock.totalSupply.returns(1000)

      await prizePool.mock.award.withArgs(wallet3.address, toWei('8'), ticket.address).returns()

      await prizeStrategy.distribute(randomNumber)
    })

    it('should blocklist address and reach the max retry count with two winners', async () => {
      await prizeStrategy.setNumberOfWinners(3)

      await prizeStrategy.setBlocklisted(wallet2.address, true)
      await prizeStrategy.setBlocklistRetryCount(2)
      await prizeStrategy.setCarryBlocklist(true)

      let randomNumber = 10
      const firstRandomNumber = '37064725103404186846061877202634929988330668626056892439536191969138221532167'
      const secondRandomNumber = '111075169755475008042669917706477765047943200936858446750481279128459241178463'
      const thirdRandomNumber = '14687395224112754347317881744031674455454498128112254032692560820774778924569'
      
      await prizePool.mock.captureAwardBalance.returns(toWei('9'))
      await ticket.mock.draw.withArgs(randomNumber).returns(wallet2.address)
      await ticket.mock.draw.withArgs(firstRandomNumber).returns(wallet3.address)
      await ticket.mock.draw.withArgs(secondRandomNumber).returns(wallet4.address)
      await ticket.mock.draw.withArgs(thirdRandomNumber).returns(wallet2.address)
      await ticket.mock.totalSupply.returns(1000)

      await prizePool.mock.award.withArgs(wallet3.address, toWei('3'), ticket.address).returns()
      await prizePool.mock.award.withArgs(wallet4.address, toWei('3'), ticket.address).returns()

      expect(await prizeStrategy.distribute(randomNumber))
        .to.emit(prizeStrategy, 'RetryMaxLimitReached')
        .withArgs(2)
    })
    
    it('should blocklist address and reach second NoWinners event', async () => {
      await prizeStrategy.setNumberOfWinners(1)

      await prizeStrategy.setBlocklisted(wallet4.address, true)
      await prizeStrategy.setBlocklistRetryCount(1)
      await prizeStrategy.setCarryBlocklist(true)

      let randomNumber = 10
      await prizePool.mock.captureAwardBalance.returns(toWei('8'))
      await ticket.mock.draw.withArgs(randomNumber).returns(wallet4.address)

      await externalERC20Award.mock.balanceOf.withArgs(prizePool.address).returns(0)
      await ticket.mock.totalSupply.returns(1000)
      
      expect(await prizeStrategy.distribute(randomNumber))
        .to.emit(prizeStrategy, 'NoWinners')
    })

    it('should blocklist address and distribute prize to single winner after selecting blocked user', async () => {
      await prizeStrategy.setNumberOfWinners(1)

      await prizeStrategy.setBlocklisted(wallet2.address, true)
      await prizeStrategy.setBlocklistRetryCount(5)
      await prizeStrategy.setCarryBlocklist(true)

      let randomNumber = 10
      const firstRandomNumber = '37064725103404186846061877202634929988330668626056892439536191969138221532167'
      await prizePool.mock.captureAwardBalance.returns(toWei('8'))
      await ticket.mock.draw.withArgs(randomNumber).returns(wallet2.address)
      await ticket.mock.draw.withArgs(firstRandomNumber).returns(wallet3.address)

      await externalERC20Award.mock.balanceOf.withArgs(prizePool.address).returns(0)
      await ticket.mock.totalSupply.returns(1000)

      await prizePool.mock.award.withArgs(wallet3.address, toWei('8'), ticket.address).returns()

      await prizeStrategy.distribute(randomNumber)
    })

    it('should blocklist address and split the prize evenly between 2 winners', async () => {
      await prizeStrategy.setNumberOfWinners(2)

      await prizeStrategy.setBlocklisted(wallet2.address, true)
      await prizeStrategy.setBlocklistRetryCount(2)

      let randomNumber = 10
      const firstRandomNumber = '37064725103404186846061877202634929988330668626056892439536191969138221532167'
      const secondRandomNumber = '111075169755475008042669917706477765047943200936858446750481279128459241178463'
      await ticket.mock.draw.withArgs(randomNumber).returns(wallet2.address)
      await ticket.mock.draw.withArgs(firstRandomNumber).returns(wallet3.address)
      await ticket.mock.draw.withArgs(secondRandomNumber).returns(wallet4.address)
      
      await ticket.mock.totalSupply.returns(1000)
      
      await prizePool.mock.captureAwardBalance.returns(toWei('8'))
      await prizePool.mock.award.withArgs(wallet3.address, toWei('4'), ticket.address).returns()
      await prizePool.mock.award.withArgs(wallet4.address, toWei('4'), ticket.address).returns()

      await prizeStrategy.distribute(randomNumber)
    })

    it('should blocklist address and carry over the prize after awarding 2 winners', async () => {
      await prizeStrategy.setNumberOfWinners(3)

      await prizeStrategy.setBlocklisted(wallet2.address, true)
      await prizeStrategy.setBlocklistRetryCount(2)
      await prizeStrategy.setCarryBlocklist(true)

      let randomNumber = 10
      const firstRandomNumber = '37064725103404186846061877202634929988330668626056892439536191969138221532167'
      const secondRandomNumber = '111075169755475008042669917706477765047943200936858446750481279128459241178463'
      const thirdRandomNumber = '14687395224112754347317881744031674455454498128112254032692560820774778924569'
      
      await prizePool.mock.captureAwardBalance.returns(toWei('9'))
      await ticket.mock.draw.withArgs(randomNumber).returns(wallet2.address)
      await ticket.mock.draw.withArgs(firstRandomNumber).returns(wallet3.address)
      await ticket.mock.draw.withArgs(secondRandomNumber).returns(wallet4.address)
      await ticket.mock.draw.withArgs(thirdRandomNumber).returns(wallet2.address)
      await ticket.mock.totalSupply.returns(1000)

      await prizePool.mock.award.withArgs(wallet3.address, toWei('3'), ticket.address).returns()
      await prizePool.mock.award.withArgs(wallet4.address, toWei('3'), ticket.address).returns()

      await prizeStrategy.distribute(randomNumber)
    })

    describe('with a real ticket contract', async () => {

      let controller, ticket

      beforeEach(async () => {
        const TokenControllerInterface = await hre.artifacts.readArtifact("TokenControllerInterface")
        controller = await deployMockContract(wallet, TokenControllerInterface.abi, overrides)
        await controller.mock.beforeTokenTransfer.returns()

        const Ticket =  await hre.ethers.getContractFactory("Ticket", wallet, overrides)
        
        ticket = await Ticket.deploy()
        await ticket.initialize("NAME", "SYMBOL", 8, controller.address)

        await controller.call(ticket, 'controllerMint', wallet.address, toWei('100'))
        await controller.call(ticket, 'controllerMint', wallet2.address, toWei('100'))

        const MultipleWinnersHarness =  await hre.ethers.getContractFactory("MultipleWinnersHarness", wallet, overrides)

        prizeStrategy = await MultipleWinnersHarness.deploy()
        debug('initializing prizeStrategy 2...')
        await prizeStrategy.initializeMultipleWinners(
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
        await prizePool.mock.award.withArgs(wallet.address, toWei('4'), ticket.address).returns()

        await prizeStrategy.setNumberOfWinners(2)
        await prizeStrategy.distribute(92) // this hashes out to the same winner twice
      })

      it('should distribute to more than one winner', async () => {
        await prizePool.mock.captureAwardBalance.returns(toWei('9'))
        await prizePool.mock.award.withArgs(wallet.address, toWei('3'), ticket.address).returns()
        await prizePool.mock.award.withArgs(wallet2.address, toWei('3'), ticket.address).returns()

        await prizeStrategy.setNumberOfWinners(3)
        await prizeStrategy.distribute(90)
      })

      it("should test awarding prize splits to multiple targets", async () => {
        const prizeSplitConfig = [
          {
            target: wallet3.address,
            percentage: "55",
            token: 1,
          },
          {
            target: wallet4.address,
            percentage: "120",
            token: 0,
          },
        ];
        
        await prizeStrategy.setNumberOfWinners(1);
        await prizeStrategy.setPrizeSplits(prizeSplitConfig);

        await prizePool.mock.captureAwardBalance.returns(toWei("100"));
        await prizePool.mock.tokens.returns([sponsorship.address, ticket.address])
        await prizePool.mock.award.withArgs(wallet3.address, toWei("5.5"), ticket.address).returns()
        await prizePool.mock.award.withArgs(wallet4.address, toWei("12"), sponsorship.address).returns()
        await prizePool.mock.award.withArgs(wallet2.address, toWei("82.5"), ticket.address).returns()
        
        let randomNumber = 10;
        await prizeStrategy.distribute(randomNumber);
      });

      describe('when external erc20 awards are distributed', () => {
        beforeEach(async () => {
          await externalERC20Award.mock.totalSupply.returns(0)
          await prizeStrategy.addExternalErc20Award(externalERC20Award.address)
        })

        it('should distribute all of the erc20 awards to the main winner', async () => {
          await prizePool.mock.captureAwardBalance.returns(toWei('0'))
          await externalERC20Award.mock.balanceOf.withArgs(prizePool.address).returns(toWei('8'))

          await prizePool.mock.awardExternalERC20.withArgs(wallet.address, externalERC20Award.address, toWei('8')).returns();

          await prizeStrategy.setNumberOfWinners(2)
          await prizeStrategy.distribute(92) // this hashes out to the same winner twice
        })

        it('should evenly distribute ERC20 awards if split is on', async () => {
          await prizePool.mock.captureAwardBalance.returns(toWei('0'))
          await externalERC20Award.mock.balanceOf.withArgs(prizePool.address).returns(toWei('9'))

          await prizePool.mock.awardExternalERC20.withArgs(wallet.address, externalERC20Award.address, toWei('3')).returns();
          await prizePool.mock.awardExternalERC20.withArgs(wallet2.address, externalERC20Award.address, toWei('3')).returns();

          await prizeStrategy.setSplitExternalErc20Awards(true)
          await prizeStrategy.setNumberOfWinners(3)
          await prizeStrategy.distribute(90) // this hashes out to the same winner twice
        })

        it('should blocklist address and carry over the external ERC20 reward after awarding 2 winners', async () => {
          await controller.call(ticket, 'controllerMint', wallet4.address, toWei('140'))
          await prizeStrategy.setNumberOfWinners(3)
    
          await prizeStrategy.setBlocklisted(wallet4.address, true)
          await prizeStrategy.setBlocklistRetryCount(2)
          await prizeStrategy.setCarryBlocklist(true)
          await prizeStrategy.setSplitExternalErc20Awards(true)
    
          let randomNumber = 10
          await prizePool.mock.captureAwardBalance.returns(toWei('0'))
          await prizePool.mock.award.withArgs('0x70997970c51812dc3a010c7d01b50e0d17dc79c8', toWei('3'), ticket.address).returns()
          await prizePool.mock.award.withArgs('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', toWei('3'), ticket.address).returns()
          
          await externalERC20Award.mock.balanceOf.withArgs(prizePool.address).returns(toWei('9'))
          await prizePool.mock.awardExternalERC20.withArgs(wallet.address, externalERC20Award.address, toWei('3')).returns();
          await prizePool.mock.awardExternalERC20.withArgs(wallet2.address, externalERC20Award.address, toWei('3')).returns();

          await prizeStrategy.distribute(randomNumber)
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
