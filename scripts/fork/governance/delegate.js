const buidler = require('@nomiclabs/buidler')
const chalk = require("chalk")

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

const { ethers, deployments, getNamedAccounts } = buidler

async function run() {
    const { pool, alphaGovernance } = await getNamedAccounts()

    const gnosisSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')

    const poolToken = await ethers.getContractAt("Pool", pool, gnosisSafe)
  
    // delegate to oneself
    dim(`delegating to self '0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f'`)
    const delegationTx = await poolToken.delegate('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')
    const createResultReceipt = await ethers.provider.getTransactionReceipt(delegationTx.hash)
    const createResultEvents = createResultReceipt.logs.map(log => { try { return poolToken.interface.parseLog(log) } catch (e) { return null } })
    
    green(`Delegated from ${createResultEvents[0].args.fromDelegate} to ${createResultEvents[0].args.toDelegate}`)

    // delegate to 


    // delegateBySig




}
run()


