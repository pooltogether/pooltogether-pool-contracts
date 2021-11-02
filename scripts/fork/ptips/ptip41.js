/*
faucet contract: 0x9A29401EF1856b669f55Ae5b24505b3B6fAEb370
parameter: dripRatePerSecondcurrently: 5787037037037037proposal: 3472222220000000
*/

const hardhat = require('hardhat')
const chalk = require("chalk")
const SablierAbi = require('../abis/Sablier.json')
const SABLIER_ADDRESS = '0xCD18eAa163733Da39c232722cBC4E8940b1D8888'
const RNG_BLOCKHASH_ADDRESS = '0xb1D89477d1b505C261bab6e73f08fA834544CD21'

function dim() {
    console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
    console.log(chalk.green.call(chalk, ...arguments))
}

function yellow() {
    console.log(chalk.yellow.call(chalk, ...arguments))
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

    const ethereumOpsTeam = '0x5Be7BbaFc73eF2a0928A793169771663a5815D48'

    const amount = '329992704000'
    const sablier = new ethers.Contract(SABLIER_ADDRESS, SablierAbi, timelock)

    // await sablier.cancelStream(100411) // 200k
    await sablier.cancelStream(100260) // 100k stream

    const scusdc = await ethers.getContractAt('IERC20Upgradeable', '0x391a437196c81eEa7BBbBd5ED4DF6b49De4F5c96', timelock)
    await scusdc.approve(sablier.address, amount)

    const startTime = Math.floor(new Date('2021-11-10T20:00:00.000Z').getTime() / 1000)
    yellow(`Start time: ${startTime}`)
    const endTime = startTime + 365 * 24 * 3600
    yellow(`End time: ${endTime}`)

    await sablier.createStream(ethereumOpsTeam, amount, scusdc.address, startTime, endTime)
    await scusdc.transfer(ethereumOpsTeam, ethers.utils.parseUnits('20000', 6))

    const uniStrat = await ethers.getContractAt('MultipleWinners', '0xe8726B85236a489a8E84C56c95790d07a368f913', timelock)
    await uniStrat.setRngService(RNG_BLOCKHASH_ADDRESS)
    await uniStrat.setPeriodicPrizeStrategyListener(ethers.constants.AddressZero)

    const compStrat = await ethers.getContractAt('MultipleWinners', '0x3ec4694b65e41f12d6b5d5ba7c2341f4d6859773', timelock)
    await compStrat.setRngService(RNG_BLOCKHASH_ADDRESS)
    await compStrat.setPeriodicPrizeStrategyListener(ethers.constants.AddressZero)

    const usdcStrat = await ethers.getContractAt('MultipleWinners', '0x3D9946190907aDa8b70381b25c71eB9adf5f9B7b', timelock)
    await usdcStrat.setPeriodicPrizeStrategyListener(ethers.constants.AddressZero)

    const daiStrat = await ethers.getContractAt('MultipleWinners', '0x178969A87a78597d303C47198c66F68E8be67Dc2', timelock)
    await daiStrat.setPeriodicPrizeStrategyListener(ethers.constants.AddressZero)

    // const mwProxy = await ethers.getContractAt('MultipleWinnersProxyFactory', '0xb789B73ebeA500e797C068C4a3D7B1b490B58475', timelock)
    // const tx = await mwProxy.create()
    // await tx.wait(1)
    // const receipt = await ethers.provider.getTransactionReceipt(tx.hash)
    // const address = '0x' + receipt.logs.data.slice(26)
    // const newUniStrat = await ethers.getContractAt('MultipleWinners', address, timelock)
    // await newUniStrat.initialize(
    //     await uniStrat.prizePeriodEndAt(),
    //     2592000, // 30 days
    //     await uniStrat.prizePool(),
    //     await uniStrat.ticket(),
    //     await uniStrat.sponsorship(),
    //     RNG_BLOCKHASH_ADDRESS,
    //     await uniStrat.numberOfWinners()
    // )

    green(`done!`)

}
run()