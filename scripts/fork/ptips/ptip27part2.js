/*
POOL.approve(0x396b4489da692788e327E2e4b2B0459A5Ef26791, 2800000000000000000000)
Deposit PPOOL into Sushi PPOOL faucet: 0x396b4489da692788e327e2e4b2b0459a5ef26791.depositTo(0xd186302304fD367488b5087Af5b12CB9B7cf7540, 
2800000000000000000000, 0x27D22A7648e955E510a40bDb058333E9190d12D4, 0x0000000000000000000000000000000000000000)
*/

const poolStakePrizePool = "0x396b4489da692788e327e2e4b2b0459a5ef26791"
const poolAddress = "0x0cec1a9154ff802e7934fc916ed7ca50bde6844e"

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
    // console.log(await ethers.provider.getBalance("0xdf9eb223bafbe5c5271415c75aecd68c21fe3d7f"))
    await etherRichSigner.sendTransaction({ to: timelock._address, value: ethers.utils.parseEther('10') })
    green(`sent!`)

    const poolStakePrizePoolContract = await ethers.getContractAt("StakePrizePool", poolStakePrizePool,timelock)
    const poolContract = await ethers.getContractAt("ERC20Upgradeable", poolAddress, timelock)

    //approve
    await poolContract.approve(poolStakePrizePool, "2800000000000000000000")
    green(`approved`)

    const ppoolTicketAddress = "0x27D22A7648e955E510a40bDb058333E9190d12D4"
    const ppoolTicketContract = await ethers.getContractAt("ERC20Upgradeable", ppoolTicketAddress)
    dim(`balance before ${await ppoolTicketContract.balanceOf("0xd186302304fD367488b5087Af5b12CB9B7cf7540")}`)

    await poolStakePrizePoolContract.depositTo("0xd186302304fD367488b5087Af5b12CB9B7cf7540", 
        "2800000000000000000000", ppoolTicketAddress, "0x0000000000000000000000000000000000000000")

    green(`balance after ${await ppoolTicketContract.balanceOf("0xd186302304fD367488b5087Af5b12CB9B7cf7540")}`)
}
run()