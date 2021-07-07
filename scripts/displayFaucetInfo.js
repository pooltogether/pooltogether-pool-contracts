const chalk = require('chalk')
const hardhat = require('hardhat')

const { ethers } = hardhat

const TOKEN_FAUCET_ADDRESS = '0x90a8d8Ee6fDb1875028C6537877E6704b2646c51'

async function consoleInfo(faucetName, faucetAddress) {
  const signers = await ethers.getSigners();
  const faucet = await ethers.getContractAt('TokenFaucet', faucetAddress, signers[0])
  const token = await ethers.getContractAt('IERC20Upgradeable', await faucet.asset(), signers[0])
  const dripRate = await faucet.dripRatePerSecond()
  const remaining = (await token.balanceOf(faucet.address)).sub(await faucet.totalUnclaimed())
  const perDay = dripRate.mul(86400)
  const secondsRemaining = remaining.div(dripRate)
  const daysRemaining = parseFloat(secondsRemaining) / 86400.0

  const finishDate = new Date((new Date().getTime()) + secondsRemaining*1000)

  console.log(chalk.dim(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`))
  console.log(chalk.green(`${faucetName} @ ${faucetAddress}`))
  console.log(``)
  console.log(`${ethers.utils.formatEther(perDay)} tokens per day`)
  console.log(`${ethers.utils.formatEther(remaining)} tokens remaining`)
  console.log(`${daysRemaining.toString()} days remaining`)
  console.log(`Ends on ${finishDate.toString()}`)
  console.log(chalk.dim(`<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<`))
}

async function displayFaucetInfo() {
  await consoleInfo('Dai POOL Faucet', '0xF362ce295F2A4eaE4348fFC8cDBCe8d729ccb8Eb')
  await consoleInfo('Uni POOL Faucet', '0xa5dddefD30e234Be2Ac6FC1a0364cFD337aa0f61')
  await consoleInfo('USDC POOL Faucet', '0xbd537257fad96e977b9e545be583bbf7028f30b9')
  await consoleInfo('COMP POOL Faucet', '0x72F06a78bbAac0489067A1973B0Cef61841D58BC')
  await consoleInfo('POOL POOL Faucet', '0x30430419b86e9512E6D93Fc2b0791d98DBeb637b')
  await consoleInfo('Sushi Sushi Faucet', '0xddcf915656471b7c44217fb8c51f9888701e759a')
}

displayFaucetInfo()
