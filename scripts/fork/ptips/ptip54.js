const hardhat = require('hardhat');
const chalk = require('chalk');
const V4YieldSourcePrizePoolAbi = require('../abis/V4YieldSourcePrizePool.json')
const ILendingPoolAbi = require('../abis/ILendingPool.json')

function dim() {
    console.log(chalk.dim.call(chalk, ...arguments));
}

function yellow() {
    console.log(chalk.yellow.call(chalk, ...arguments));
}

function green() {
    console.log(chalk.green.call(chalk, ...arguments));
}

async function run() {
    const { ethers } = hardhat;
    const { provider, utils } = ethers;

    const timelockAddress = '0x42cd8312D2BCe04277dD5161832460e95b24262E'
    await hre.ethers.provider.send("hardhat_impersonateAccount",[timelockAddress])
    const timelock = await provider.getUncheckedSigner(timelockAddress)
    const reserve = await hre.ethers.getContractAt('Reserve', '0xd1797d46c3e825fce5215a0259d3426a5c49455c', timelock)
    const usdcContract = await ethers.getContractAt("ERC20Upgradeable", "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", timelock)
    const dai = await ethers.getContractAt('Dai', '0x6b175474e89094c44da98b954eedeac495271d0f', timelock)
    const scusdc = await ethers.getContractAt('IERC20Upgradeable', '0x391a437196c81eEa7BBbBd5ED4DF6b49De4F5c96', timelock)
    const tribeTokenContract = await ethers.getContractAt("IERC20Upgradeable","0xc7283b66eb1eb5fb86327f08e1b5816b0720212b",timelock)
    const aDaiContract = await ethers.getContractAt("IERC20Upgradeable","0x028171bCA77440897B824Ca71D1c56caC55b68A3",timelock)
    const usdcPrizePool = await ethers.getContractAt("CompoundPrizePool", "0xde9ec95d7708b8319ccca4b8bc92c0a3b70bf416", timelock)
    const aaveLendingPool = new ethers.Contract('0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9',ILendingPoolAbi, timelock)
    const daiAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F'

    const v4usdcPrizePoolAddress = '0xd89a09084555a7D0ABe7B111b1f78DFEdDd638Be'
    const v4usdcPrizePool = new ethers.Contract(v4usdcPrizePoolAddress, V4YieldSourcePrizePoolAbi, timelock)

    dim(`Step 1: withdrawing USDC reserve...`)
    dim(`USDC balance before: ${hre.ethers.utils.formatUnits(await usdcContract.balanceOf(timelockAddress), 6)}`)
    const tx = await reserve.withdrawReserve(
        '0xde9ec95d7708B8319CCca4b8BC92c0a3B70bf416',
       timelockAddress
    )
    await tx.wait()
    dim(`USDC balance after: ${hre.ethers.utils.formatUnits(await usdcContract.balanceOf(timelockAddress), 6)}`)
    green(`done step 1`)

    dim(`Step 2: Withdraw the USDC sponsorship to the governance timelock`)
    dim(`USDC balance before: ${hre.ethers.utils.formatUnits(await usdcContract.balanceOf(timelockAddress), 6)}`)
    await usdcPrizePool.withdrawInstantlyFrom(
        timelockAddress,
        '2842086584286',
        scusdc.address,
        0
    )
    dim(`USDC balance after: ${hre.ethers.utils.formatUnits(await usdcContract.balanceOf(timelockAddress), 6)}`)
    green(`done step 2`)

    dim(`Step 3: Withdraw the DAI reserve to the governance timelock`)
    dim(`Dai balance before: ${hre.ethers.utils.formatUnits(await dai.balanceOf(timelockAddress))}`)
    await reserve.withdrawReserve(
        '0xEBfb47A7ad0FD6e57323C8A42B2E5A6a4F68fc1a',
        timelockAddress
    )
    dim(`Dai balance after: ${hre.ethers.utils.formatUnits(await dai.balanceOf(timelockAddress))}`)
    green(`done step 3`)

    dim(`Step 4: Approve V4 to spend timelock USDC of ${ethers.constants.MaxUint256}`)
    await usdcContract.approve(v4usdcPrizePoolAddress, ethers.constants.MaxUint256)
    green(`done step 4`)

    dim(`Step 5: Deposit into v4 prize pool`)
    await v4usdcPrizePool.depositTo(timelockAddress, '3798792000000') 
    green(`done step 5`)

    const aaveDepositAmount = '482371000000000000000000'

    dim(`Step 6: Approve DAI for Aave deposit`)
    await dai.approve(aaveLendingPool.address, aaveDepositAmount) 

    dim(`Step 7: Deposit DAI to Aave V2`)
    dim(`Before aDai balance: ${await aDaiContract.balanceOf(timelockAddress)}`)
    await aaveLendingPool.deposit(daiAddress,aaveDepositAmount,timelockAddress,188)
    dim(`After aDai balance: ${await aDaiContract.balanceOf(timelockAddress)}`)
    green(`done step 7`)

    dim(`Step 8: Transfer TRIBE to exec-team`)
    await tribeTokenContract.transfer('0xDa63D70332139E6A8eCA7513f4b6E2E0Dc93b693','36499756541516112442856')
    green(`done step 8`)
}

run()
