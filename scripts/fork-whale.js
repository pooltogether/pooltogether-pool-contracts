const chalk = require('chalk')
const buidler = require('@nomiclabs/buidler')

async function run() {
  console.log(chalk.dim(`Gathering dai from whale....`))
  const { ethers } = buidler
  const { provider, getContractAt } = ethers

  console.log(chalk.dim(`Creating binance 3 wallet....`))

  const signer = await provider.getUncheckedSigner('0x564286362092D8e7936f0549571a803B203aAceD')

  console.log(chalk.dim(`Getting dai contract....`))

  const dai = await getContractAt('Dai', '0x6b175474e89094c44da98b954eedeac495271d0f', signer)

  const signers = await ethers.getSigners()

  console.log(chalk.dim(`Sending 1000 dai to ${signers[0]._address}`))
  await dai.connect(signer).transfer(signers[0]._address, ethers.utils.parseEther('1000'))

  console.log(chalk.green(`Done!`))
}

run()