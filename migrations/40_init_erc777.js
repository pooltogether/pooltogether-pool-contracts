const tdr = require('truffle-deploy-registry')
const TokenizedPool = artifacts.require('TokenizedPool.sol')

module.exports = function(deployer, networkName, accounts) {
  if (tdr.isDryRunNetworkName(networkName)) { return }
  deployer.then(async () => {
    const token = await TokenizedPool.deployed()
    
    await token.initERC777('Prize Dai', 'pzDai', [])
  })
};
