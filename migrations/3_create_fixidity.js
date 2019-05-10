// 1_initial_migration.js
const shell = require('shelljs')
const tdr = require('truffle-deploy-registry')

module.exports = function(deployer, networkName) {
  if (tdr.isDryRunNetworkName(networkName)) { return }
  deployer.then(async () => {
    if (shell.exec(`zos create Fixidity --network ${networkName} --from ${process.env.ADMIN_ADDRESS}`).code !== 0) {
      throw new Error('Migration failed')
    }
  })
};
