/*
faucet contract: 0x9A29401EF1856b669f55Ae5b24505b3B6fAEb370
parameter: dripRatePerSecondcurrently: 5787037037037037proposal: 3472222220000000
*/


const hardhat = require('hardhat')
const chalk = require("chalk")
const SablierAbi = require('../abis/Sablier.json')
const SABLIER_ADDRESS = '0xCD18eAa163733Da39c232722cBC4E8940b1D8888'

function dim() {
    console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
    console.log(chalk.green.call(chalk, ...arguments))
}

async function run() {
    const { ethers } = hardhat
    const { provider } = ethers

    await hre.ethers.provider.send("hardhat_impersonateAccount",["0x42cd8312D2BCe04277dD5161832460e95b24262E"])
    const timelock = await provider.getUncheckedSigner('0x42cd8312D2BCe04277dD5161832460e95b24262E')

    await hre.ethers.provider.send("hardhat_impersonateAccount",["0xdf9eb223bafbe5c5271415c75aecd68c21fe3d7f"])
    const etherRichSigner = await provider.getUncheckedSigner('0xdf9eb223bafbe5c5271415c75aecd68c21fe3d7f')

    dim(`Sending 10 ether to ${timelock._address}...`)
    console.log(await ethers.provider.getBalance("0xdf9eb223bafbe5c5271415c75aecd68c21fe3d7f"))
    await etherRichSigner.sendTransaction({ to: timelock._address, value: ethers.utils.parseEther('10') })
    green(`sent!`)

    const ethereumOpsTeam = '0x5Be7BbaFc73eF2a0928A793169771663a5815D48'

    const amount = '91990512000'
    const sablier = new ethers.Contract(SABLIER_ADDRESS, SablierAbi, timelock)

    const scusdc = await ethers.getContractAt('IERC20Upgradeable', '0x391a437196c81eEa7BBbBd5ED4DF6b49De4F5c96', timelock)
    await scusdc.approve(sablier.address, amount)

    green('approved')

    const startTime = 1630886400
    const endTime = 1662422400 // startTime + 31536000

    await sablier.createStream(ethereumOpsTeam, amount, scusdc.address, startTime, endTime)

    green('created stream')

    green(`done!`)

}
run()