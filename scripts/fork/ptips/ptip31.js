/*
faucet contract: 0x9A29401EF1856b669f55Ae5b24505b3B6fAEb370
parameter: dripRatePerSecondcurrently: 5787037037037037proposal: 3472222220000000
*/


const hardhat = require('hardhat')
const chalk = require("chalk")

const sushippoolFaucetAddress = "0x9A29401EF1856b669f55Ae5b24505b3B6fAEb370"

function dim() {
    console.log(chalk.dim.call(chalk, ...arguments))
}

function yellow() {
    console.log(chalk.yellow.call(chalk, ...arguments))
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

    const sushippoolFaucetContract = await ethers.getContractAt("TokenFaucet", sushippoolFaucetAddress,timelock)
    await sushippoolFaucetContract.setDripRatePerSecond("3472222220000000")
    
    green(`done!`)

}
run()