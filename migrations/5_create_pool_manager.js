// 1_initial_migration.js
const shell = require('shelljs')

module.exports = function(deployer, networkName, accounts) {
  deployer.then(async () => {
    const blocksPerDay = 6171
    const openDuration = 2 * blocksPerDay
    const lockDuration = 15 * blocksPerDay

    let tokenAddress, cDAI
    // Compound DAI token on Rinkeby
    if (networkName === 'rinkeby') {
      console.log('Using rinkeby config')
      // See https://compound.finance/developers#getting-started 
    // and https://rinkeby.etherscan.io/address/0x6d7f0754ffeb405d23c51ce938289d4835be3b14
      tokenAddress = '0x5592EC0cfb4dbc12D3aB100b257153436a1f0FEa'
      cDAI = '0x6d7f0754ffeb405d23c51ce938289d4835be3b14'
    } else if (networkName === 'mainnet') {
      console.log('Using mainnet config')
      tokenAddress = '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359'
      cDAI = '0xf5dce57282a584d2746faf1593d3121fcac444dc'
    }

    const ticketPrice = web3.utils.toWei('20', 'ether')
    const feeFraction = web3.utils.toWei('0.1', 'ether')

    if (shell.exec(`zos create PoolManager --init init --args ${accounts[0]},${cDAI},${tokenAddress},${openDuration},${lockDuration},${ticketPrice},${feeFraction},true --network ${networkName} --from ${process.env.ADMIN_ADDRESS}`).code !== 0) {
      throw new Error('Migration failed')
    }
  })
};
