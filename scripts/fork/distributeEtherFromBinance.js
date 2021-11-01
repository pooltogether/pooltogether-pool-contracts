const chalk = require('chalk')
const hardhat = require('hardhat')
const {
  SUSHI_HOLDER,
  USDT_HOLDER,
  GUSD_HOLDER,
  BUSD_HOLDER,
  SUSD_HOLDER,
  DAI_HOLDER
} = require('./constants')
const { getNamedAccounts } = hardhat

async function run() {
  console.log(chalk.dim(`Gathering funds from Binance....`))
  const { ethers } = hardhat
  const { provider, getContractAt } = ethers
  const { deployer } = await getNamedAccounts()
  
  const binance = await provider.getUncheckedSigner('0xF977814e90dA44bFA03b6295A0616a897441aceC')

  const recipients = {
    ['Operations Safe']: '0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f',
    ['Treasury Safe']: '0x77383BaDb05049806d53e9def0C8128de0D56D90',
    ['Protocol Treasury']: '0x42cd8312D2BCe04277dD5161832460e95b24262E',
    ['Deployer']: deployer,
    ['Dai Holder']: DAI_HOLDER,
    ['Sushi Holder']: SUSHI_HOLDER, 
    ['USDT Holder']: USDT_HOLDER,
    ['GUSD Holder']: GUSD_HOLDER,
    ['BUSD Holder']: BUSD_HOLDER,
    ['SUSD Holder']: SUSD_HOLDER
  }

  const keys = Object.keys(recipients)

  for (var i = 0; i < keys.length; i++) {
    const name = keys[i]
    const address = recipients[name]
    console.log(chalk.dim(`Sending 100 Ether to ${name}...`))
    await binance.sendTransaction({ to: address, value: ethers.utils.parseEther('100') })
  }

  console.log(chalk.green(`Done!`))
}

run()