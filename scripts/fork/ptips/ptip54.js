const hardhat = require('hardhat');
const chalk = require('chalk');
const V4YieldSourcePrizePoolAbi = require('../abis/V4YieldSourcePrizePool.json')

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
    const usdcPrizePool = await ethers.getContractAt("CompoundPrizePool", "0xde9ec95d7708b8319ccca4b8bc92c0a3b70bf416", timelock)
    
    const notionalAddress = '0x1344A36A1B56144C3Bc62E7757377D288fDE0369'

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
    dim(`done step 4`)

    dim(`Step 5: Deposit into v4 prize pool`)
    await v4usdcPrizePool.depositTo(timelockAddress, '3290000000000')
    dim(`done step 5`)

    const usdcAmount = ethers.utils.parseUnits('500000', 6)
    dim(`Step 6: approve ${usdcAmount} usdc on Notional`)
    await usdcContract.approve(notionalAddress, usdcAmount)
    dim(`done step 6`)

    const daiAmount = ethers.utils.parseUnits('500000', 18)
    dim(`Step 7: approve ${daiAmount} dai on Notional`)
    await usdcContract.approve(notionalAddress, daiAmount)
    dim(`done step 7`)

    
}

run()
