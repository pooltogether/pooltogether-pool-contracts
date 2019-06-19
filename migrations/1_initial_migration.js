// 1_initial_migration.js
const shell = require('shelljs')

module.exports = function(deployer, networkName, accounts) {
  deployer.then(() => {
    if (shell.exec(`zos create Migrations --init initialize --args ${accounts[0]} --network ${networkName} --from ${process.env.ADMIN_ADDRESS}`).code !== 0) {
      throw new Error('Migration failed')
    }
  })
};
