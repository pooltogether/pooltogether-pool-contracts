const chalk = require('chalk')
const hardhat = require('hardhat')

const { getNamedAccounts } = hardhat

async function run() {
  console.log(chalk.dim(`Gathering funds from Binance....`))
  const { ethers } = hardhat
  const { provider, getContractAt } = ethers
  const { deployer } = await getNamedAccounts()
  
  const binance = await provider.getUncheckedSigner('0x564286362092D8e7936f0549571a803B203aAceD')
  const binance7 = await provider.getUncheckedSigner('0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8')
  const dai = await getContractAt('Dai', '0x6b175474e89094c44da98b954eedeac495271d0f', binance)
  const usdc = await getContractAt('Dai', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', binance7)

  const recipients = {
    ['Operations Safe']: '0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f',
    ['Treasury Safe']: '0x77383BaDb05049806d53e9def0C8128de0D56D90',
    ['Protocol Treasury']: '0x42cd8312D2BCe04277dD5161832460e95b24262E',
    ['Deployer']: deployer
  }

  const keys = Object.keys(recipients)

  for (var i = 0; i < keys.length; i++) {
    const name = keys[i]
    const address = recipients[name]
    console.log(chalk.dim(`Sending 1000 Dai to ${name}...`))
    await dai.transfer(address, ethers.utils.parseEther('1000'))
    console.log(chalk.dim(`Sending 1000 USDC to ${name}...`))
    await usdc.transfer(address, ethers.utils.parseUnits('1000', 8))
    console.log(chalk.dim(`Sending 1000 Ether to ${name}...`))
    await binance.sendTransaction({ to: address, value: ethers.utils.parseEther('1000') })
  }

  console.log(chalk.green(`Done!`))
}

run()