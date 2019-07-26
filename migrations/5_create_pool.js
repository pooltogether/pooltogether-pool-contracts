// 1_initial_migration.js
const shell = require('shelljs')

module.exports = function(deployer, networkName, accounts) {
  deployer.then(async () => {
    let cDAI
    // Compound DAI token on Rinkeby
    if (networkName === 'rinkeby') {
      console.log('Using rinkeby config')
      // See https://compound.finance/developers#getting-started 
      // and https://rinkeby.etherscan.io/address/0x6d7f0754ffeb405d23c51ce938289d4835be3b14
      cDAI = '0x6d7f0754ffeb405d23c51ce938289d4835be3b14'
    } else if (networkName === 'mainnet') {
      console.log('Using mainnet config')
      cDAI = '0xf5dce57282a584d2746faf1593d3121fcac444dc'
    }

    const feeFraction = web3.utils.toWei('0.1', 'ether')

    if (shell.exec(`oz create Pool --init init --args ${accounts[0]},${cDAI},${feeFraction},${accounts[0]} --network ${networkName} --from ${process.env.ADMIN_ADDRESS}`).code !== 0) {
      throw new Error('Migration failed')
    }
  })
};
