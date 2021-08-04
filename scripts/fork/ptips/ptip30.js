/*
    withdrawInstantlyFrom()

    transfer usdc to 0xC2bc2F890067C511215f9463a064221577a53E10 (C4 audit)
*/

const c4Address = "0xC2bc2F890067C511215f9463a064221577a53E10"

const hardhat = require('hardhat')
const chalk = require("chalk")

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
    await etherRichSigner.sendTransaction({ to: timelock._address, value: ethers.utils.parseEther('10') })
    green(`sent!`)

    const usdcPrizePool = await ethers.getContractAt("CompoundPrizePool", "0xde9ec95d7708b8319ccca4b8bc92c0a3b70bf416", timelock)

    const usdcContract = await ethers.getContractAt("ERC20Upgradeable", "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", timelock)

    const withdrawAmount = ethers.utils.parseUnits("150000",6)
    
    await usdcPrizePool.withdrawInstantlyFrom(timelock._address, withdrawAmount, "0x391a437196c81eEa7BBbBd5ED4DF6b49De4F5c96", withdrawAmount)

    await usdcContract.transfer(c4Address, withdrawAmount)

    green(`done!`)

}
run()