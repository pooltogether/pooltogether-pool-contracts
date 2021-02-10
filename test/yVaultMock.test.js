const { ethers } = require('ethers')
const { expect } = require('chai')
const hardhat = require('hardhat')

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:yVaultMock.test')

let overrides = { gasLimit: 9500000 }

describe('yVaultMock', function() {
  let wallet, wallet2

  let erc20token, vault

  beforeEach(async () => {
    [wallet, wallet2] = await hardhat.ethers.getSigners()
    debug(`using wallet ${wallet.address}`)

    debug('creating token...')
    const ERC20MintableContract =  await hre.ethers.getContractFactory("ERC20Mintable", wallet, overrides)
   
    
    erc20token = await ERC20MintableContract.deploy("TOKEN", "TOKE")

    debug('creating vault...')
    const yVaultMock =  await hre.ethers.getContractFactory("yVaultMock", wallet, overrides)
    vault = await yVaultMock.deploy(erc20token.address)
  })

  describe('deposit()', () => {
    it('should take tokens from the sender and mint shares', async () => {
      await erc20token.mint(wallet.address, toWei('100'))

      await erc20token.approve(vault.address, toWei('100'))

      await vault.deposit(toWei('100'))

      expect(await vault.balanceOf(wallet.address)).to.equal(toWei('100'))
      expect(await erc20token.balanceOf(vault.address)).to.equal(toWei('100'))
    })
  })

  describe('withdraw', () => {
    beforeEach(async () => {
      await erc20token.mint(wallet.address, toWei('100'))
      await erc20token.approve(vault.address, toWei('100'))
      await vault.deposit(toWei('100'))
    })

    it('should return the users deposit less reserve', async () => {
      await vault.withdraw(toWei('100'))

      expect(await erc20token.balanceOf(wallet.address)).to.equal(toWei('95'))
    })
  })

});
