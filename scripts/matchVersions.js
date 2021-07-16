#!/usr/bin/env node

const packageDotJson = require("../package.json")
const chalk = require("chalk")
const fs = require('fs')

function yellow() {
    console.log(chalk.yellow.call(chalk, ...arguments))
}

function red() {
    console.log(chalk.red.call(chalk, ...arguments))
}

async function run () {    
    const packageVersion = packageDotJson.version
    yellow(`Checking NPM package version ${packageVersion} matches contract VERSION constant..`)
    
    // get PrizePool VERSION
    const prizePoolFile = (await fs.readFileSync('./contracts/prize-pool/PrizePool.sol')).toString()
    if (!prizePoolFile.match(`string constant public VERSION = "${packageVersion}";`)) {
        const msg = `PrizePool version does not match ${packageVersion}`
        red(msg)
        throw new Error(msg)
    }

    // get PrizeStrategy VERSION
    const prizeStrategyFile = (await fs.readFileSync('./contracts/prize-strategy/PeriodicPrizeStrategy.sol')).toString()
    if (!prizeStrategyFile.match(`string constant public VERSION = "${packageVersion}";`)) {
        const msg = `PeriodicPrizeStrategy version does not match ${packageVersion}`
        red(msg)
        throw new Error(msg)
    }
    
}
run()