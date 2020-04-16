const { fetchUsers } = require('./fetchUsers')
const { exec } = require('./exec')
const chalk = require('chalk')
const {
  DAI,
  DAI_BUDDY,
  BINANCE_ADDRESS
} = require('./helpers/constants')

async function transferDai (context, recipient, amount) {
  console.log(chalk.yellow('Starting ethers payments to admin and users...'))

  const {
    provider,
    artifacts,
    ethers
  } = context

  // Dai buddy has lots of Dai
  let signer = provider.getSigner(DAI_BUDDY)
  
  // Binance 7 account.  Has *tons* of Ether
  let binance = provider.getSigner(BINANCE_ADDRESS)

  const dai = new ethers.Contract(DAI, artifacts.ERC20.abi, signer)

  // Ensure Dai buddy has eth
  console.log(chalk.yellow(`Send eth to Dai buddy...`))
  await exec(provider, binance.sendTransaction({ to: DAI_BUDDY, value: ethers.utils.parseEther('100') }))
  console.log(chalk.dim(`Sent eth`))

  // Transfer eth to the admin so that we can deploy contracts
  console.log(chalk.yellow(`Starting Dai transfer of ${amount} to ${recipient}`))
  await exec(provider, dai.transfer(recipient, ethers.utils.parseEther(amount)))
  console.log(chalk.green('Completed Dai transfer.'))
}

module.exports = {
  transferDai
}
