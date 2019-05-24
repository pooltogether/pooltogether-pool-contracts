// 1_initial_migration.js
const shell = require('shelljs')
const tdr = require('truffle-deploy-registry')

module.exports = function(deployer, networkName, accounts) {
  if (tdr.isDryRunNetworkName(networkName)) { return }
  deployer.then(async () => {
    const blocksPerDay = 6171
    const openDuration = 1 * blocksPerDay
    const lockDuration = 28 * blocksPerDay

    const tokenAddress = '0x4e17c87c52d0E9a0cAd3Fbc53b77d9514F003807'
    const moneyMarketAddress = '0x61bbd7bd5ee2a202d7e62519750170a52a8dfd45'

    const ticketPrice = web3.utils.toWei('20', 'ether')
    const feeFraction = web3.utils.toWei('0.05', 'ether')

    if (shell.exec(`zos create PoolManager --init init --args ${accounts[0]},${moneyMarketAddress},${tokenAddress},${openDuration},${lockDuration},${ticketPrice},${feeFraction},false --network ${networkName} --from ${process.env.ADMIN_ADDRESS}`).code !== 0) {
      throw new Error('Migration failed')
    }
  })
};
