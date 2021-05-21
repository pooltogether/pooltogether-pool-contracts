const chalk = require('chalk')
const hardhat = require('hardhat')
const {
  DAI_HOLDER
} = require('./constants')
const { getNamedAccounts, ethers } = hardhat

async function run() {
  const daiHolder = await ethers.provider.getUncheckedSigner(DAI_HOLDER)

  const cToken = await ethers.getContractAt('CTokenInterface', '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643', daiHolder)
  const dai = await ethers.getContractAt('Dai', '0x6b175474e89094c44da98b954eedeac495271d0f', daiHolder)

  const currentBalance = await cToken.balanceOf(daiHolder._address)
  await cToken.redeem(currentBalance)

  let depositAmount = ethers.utils.parseEther('100000')
  await dai.approve(cToken.address, depositAmount)
  await cToken.mint(depositAmount)

  console.log("underyling balance: ", ethers.utils.formatEther(await cToken.callStatic.balanceOfUnderlying(daiHolder._address)))

  let balance = parseFloat(ethers.utils.formatEther(await cToken.balanceOf(daiHolder._address)))
  let totalSupply = parseFloat(ethers.utils.formatEther(await cToken.totalSupply()))

  console.log('Fraction: ', balance / totalSupply)

  // transfer huge sum of money
  let daiBalance = await dai.balanceOf(daiHolder._address)
  console.log("Balance: ", ethers.utils.formatEther(daiBalance))

  console.log("Fraction of balance: ", (balance / totalSupply) * parseFloat(ethers.utils.formatEther(daiBalance)))

  await dai.transfer(cToken.address, daiBalance)

  

  console.log("underyling balance after $100m: ", ethers.utils.formatEther(await cToken.callStatic.balanceOfUnderlying(daiHolder._address)))

  console.log(chalk.green(`Done!`))
}

run()