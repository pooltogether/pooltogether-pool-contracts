const { deployMockContract } = require('ethereum-waffle')

const { ethers } = require('ethers')
const { expect } = require('chai')
const hre = require('hardhat')
const { AddressZero } = require('ethers').constants

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:BalanceDripManagerExposed.test')
const SENTINAL = '0x0000000000000000000000000000000000000001'

let overrides = { gasLimit: 9500000 }

describe('BalanceDripManagerExposed', function() {

  let dripExposed

  let measure, drip1, drip2, drip3

  let invalidDrip = '0x0000000000000000000000000000000000000003'
  let wallet, wallet2, wallet3, wallet4


  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await hre.ethers.getSigners()
    const BalanceDripExposedContract = await hre.ethers.getContractFactory("BalanceDripManagerExposed", wallet, overrides)
    dripExposed = await BalanceDripExposedContract.deploy()

    debug({ dripExposed: dripExposed.address })
    
    const ERC20MintableContract =  await hre.ethers.getContractFactory("ERC20Mintable", wallet, overrides)
    measure = await ERC20MintableContract.deploy('Measure Token', 'MTKN')
   
    drip1 = await ERC20MintableContract.deploy('Drip Token 1', 'DRIP1')
    drip2 = await ERC20MintableContract.deploy('Drip Token 2', 'DRIP2')
    const IERC20 = await hre.artifacts.readArtifact("IERC20Upgradeable")
    drop3 = await deployMockContract(wallet, IERC20.abi)

    
  })

  describe('activateDrip()', () => {
    it('should activate a drip token', async () => {
      await dripExposed.activateDrip(measure.address, drip1.address, toWei('0.001'))
      expect(await dripExposed.isDripActive(measure.address, drip1.address)).to.be.true
    })

    it('should support a second drip token', async () => {
      await dripExposed.activateDrip(measure.address, drip1.address, toWei('0.001'))
      await dripExposed.activateDrip(measure.address, drip2.address, toWei('0.001'))
      expect(await dripExposed.isDripActive(measure.address, drip1.address)).to.be.true
      expect(await dripExposed.isDripActive(measure.address, drip2.address)).to.be.true
    })

    it('should not add a drip token twice', async () => {
      await dripExposed.activateDrip(measure.address, drip1.address, toWei('0.001'))
      await expect(dripExposed.activateDrip(measure.address, drip1.address, toWei('0.001'))).to.be.revertedWith('BalanceDripManager/drip-active')
    })
  })

  describe('deactivateDrip()', () => {
    it('should allow a drip to be deactivated', async () => {
      await dripExposed.activateDrip(measure.address, drip1.address, toWei('0.001'))
      expect(await dripExposed.isDripActive(measure.address, drip1.address)).to.be.true

      await dripExposed.deactivateDrip(measure.address, drip1.address, SENTINAL, '2', toWei('100'))
      expect(await dripExposed.isDripActive(measure.address, drip1.address)).to.be.false

      let detail = await dripExposed.getDrip(measure.address, drip1.address);
      expect(detail.dripRatePerSecond).to.equal(0)
    })
  })

  describe('getActiveBalanceDrips()', () => {
    it('should return a list of active balance drip tokens', async () => {
      await dripExposed.activateDrip(measure.address, drip1.address, toWei('0.001'))
      expect(await dripExposed.getActiveBalanceDrips(measure.address))
        .to.deep.equal([drip1.address])
    })
  })

  describe('setDripRate()', () => {
    it('should revert when setting drips that are not active', async () => {
      await expect(dripExposed.setDripRate(measure.address, invalidDrip, toWei('0.001'), '1', toWei('100')))
        .to.be.revertedWith('BalanceDripManager/drip-not-active')
    })

    it('should allow the drip rate to be changed', async () => {
      await dripExposed.activateDrip(measure.address, drip1.address, toWei('0.001'))
      await dripExposed.setDripRate(measure.address, drip1.address, toWei('0.1'), '2', toWei('100'))

      let detail = await dripExposed.getDrip(measure.address, drip1.address)

      expect(detail.dripRatePerSecond).to.equal(toWei('0.1'))
    })
  })

});
