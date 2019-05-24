// 1_initial_migration.js
const shell = require('shelljs')
const tdr = require('truffle-deploy-registry')

module.exports = function(deployer, networkName, accounts) {
  if (tdr.isDryRunNetworkName(networkName)) { return }
  deployer.then(async () => {
    const blocksPerDay = 6171
    const openDuration = 1 * blocksPerDay
    const lockDuration = 28 * blocksPerDay

    // Compound DAI token on Rinkeby
    const tokenAddress = '0x5592EC0cfb4dbc12D3aB100b257153436a1f0FEa'

    // See https://compound.finance/developers#getting-started 
    // and https://rinkeby.etherscan.io/address/0x6d7f0754ffeb405d23c51ce938289d4835be3b14
    const cDAI = '0x6d7f0754ffeb405d23c51ce938289d4835be3b14'

    const ticketPrice = web3.utils.toWei('20', 'ether')
    const feeFraction = web3.utils.toWei('0.05', 'ether')

    if (shell.exec(`zos create PoolManager --init init --args ${accounts[0]},${cDAI},${tokenAddress},${openDuration},${lockDuration},${ticketPrice},${feeFraction},false --network ${networkName} --from ${process.env.ADMIN_ADDRESS}`).code !== 0) {
      throw new Error('Migration failed')
    }
  })
};
