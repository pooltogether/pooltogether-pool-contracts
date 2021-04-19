const chalk = require('chalk')
const hardhat = require('hardhat')
const {
  MATIC_HOLDER,
  DAI_HOLDER
} = require('./constants')

async function run() {
  const { ethers } = hardhat
  const { provider } = ethers
  
  const maticHolder = await provider.getUncheckedSigner(MATIC_HOLDER)

  const recipients = {
    ['DAI Holder']: DAI_HOLDER
  }

  const keys = Object.keys(recipients)

  for (var i = 0; i < keys.length; i++) {
    const name = keys[i]
    const address = recipients[name]
    console.log(chalk.dim(`Sending 10 Ether to ${name}...`))
    await maticHolder.sendTransaction({ to: address, value: ethers.utils.parseEther('10') })
  }

  console.log(chalk.green(`Done!`))
}

run()