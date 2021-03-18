const { deployMockContract } = require('ethereum-waffle')
const { expect } = require('chai')
const hardhat = require('hardhat')

describe('CTokenYieldSource', function() {

  let cToken
  let cTokenYieldSource

  let wallet
  let otherWallet

  beforeEach(async () => {
    [wallet, otherWallet] = await hardhat.ethers.getSigners()

    const CTokenInterfaceArtifact = await hre.artifacts.readArtifact('CTokenInterface')        
    cToken = await deployMockContract(wallet, CTokenInterfaceArtifact.abi)
    
    const CTokenYieldSourceFactory = await hre.ethers.getContractFactory("CTokenYieldSource", wallet)
    cTokenYieldSource = await CTokenYieldSourceFactory.deploy(cToken.address)
  })

  describe('balanceOf()', function() {
    it('should return 0 when empty', async () => {
      await cToken.mock.balanceOfUnderlying.returns('0')
      await cToken.mock.balanceOf.returns('0')
      expect(await cTokenYieldSource.callStatic.balanceOfToken(wallet.address)).to.equal('0')
    })
  });
});
