const packageDotJson = require("../package.json")
const hardhat = require("hardhat")
const { ethers } = require("hardhat")

function yellow() {
    console.log(chalk.yellow.call(chalk, ...arguments))
  }

async function run () { 
    const packageVersion = packageDotJson.version
    yellow(`Checking NPM package version ${packageVersion} matches contract VERSION constant..`)
    
    const deployments = await deployments.all()
    
    // get PrizePool VERSION
    const prizePoolArtifact = await hardhat.artifacts.readArtifact("PrizePool")
    const prizePool = await ethers.getContractAt("PrizePool", deployments["CompoundPrizePool"])
    const prizePoolVersion = await prizePool.VERSION()

    // get PrizeStrategy VERSION
    const prizeStrategy = await hardhat.ethers.getContract("PeriodicPrizeStrategy")
    const prizeStrategyVersion = await prizeStrategy.VERSION()

    // assert packgeVersion == prizePoolVersion == prizeStrategyVersion

}
run()