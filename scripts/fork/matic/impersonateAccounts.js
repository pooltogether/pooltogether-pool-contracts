const chalk = require('chalk')
const hre = require("hardhat")

const {
  DAI_HOLDER,
  MATIC_HOLDER
} = require('./constants')

async function run(){
    await hre.ethers.provider.send("hardhat_impersonateAccount", ["0x0000000000000000000000000000000000000000"])
    await hre.ethers.provider.send("hardhat_impersonateAccount",[DAI_HOLDER])
    await hre.ethers.provider.send("hardhat_impersonateAccount",[MATIC_HOLDER])
    console.log(chalk.green('Impersonated accounts'))
}
run()
