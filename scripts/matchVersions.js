const packageDotJson = require("../package.json")
const hardhat = require("hardhat")
const { ethers } = require("hardhat")
const chalk = require("chalk")


function yellow() {
    console.log(chalk.yellow.call(chalk, ...arguments))
}

function green() {
    console.log(chalk.green.call(chalk, ...arguments))
}

function red() {
    console.log(chalk.red.call(chalk, ...arguments))
}

async function run () {
    
    if(hardhat.network != "mainnet"){
        return
    }
    
    const packageVersion = packageDotJson.version
    yellow(`Checking NPM package version ${packageVersion} matches contract VERSION constant..`)
    
    // get PrizePool VERSION
    const prizePoolFactory = await ethers.getContractFactory("CompoundPrizePool")
    const prizePoolDeployResult = await prizePoolFactory.deploy()
    const prizePool  = await ethers.getContractAt("CompoundPrizePool", prizePoolDeployResult.address)
    const prizePoolVersion = await prizePool.VERSION()
    
    // get PrizeStrategy VERSION
    const prizeStrategyFactory = await ethers.getContractFactory("MultipleWinners")
    const deployResult = await prizeStrategyFactory.deploy()
    const prizeStrategy  = await ethers.getContractAt("MultipleWinners", deployResult.address)
    const prizeStrategyVersion = await prizeStrategy.VERSION()

    // assert packgeVersion == prizePoolVersion == prizeStrategyVersion
    if(packageVersion != prizePoolVersion){
        throw new Error(red(`PrizePool contract Version (${prizePoolVersion}) different from package.json (${packageVersion})`))
    }
    else if(packageVersion != prizeStrategyVersion){
        throw new Error(red(`PrizeStrategy contract Version (${prizeStrategyVersion}) different from package.json (${packageVersion})`))
    }

}
run()