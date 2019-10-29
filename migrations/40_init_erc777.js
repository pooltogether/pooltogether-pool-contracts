const tdr = require('truffle-deploy-registry')
const Pool = artifacts.require('Pool.sol')

module.exports = function(deployer, networkName, accounts) {
  if (tdr.isDryRunNetworkName(networkName)) { return }
  deployer.then(async () => {
    const token = await Pool.deployed()
    
    await token.initERC777('Prize Dai', 'pzDai', [])
  })
};
