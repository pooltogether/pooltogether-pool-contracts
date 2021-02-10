const hardhat = require('hardhat')
const chalk = require("chalk")

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

const employeeLiAddress = require("../../../../governance/deployments/fork/TreasuryVesterForEmployeeLi.json").address
const employeeBAddress = require("../../../../governance/deployments/fork/TreasuryVesterForEmployeeB.json").address
const poolAddress = require("../../../../governance/deployments/fork/Pool.json").address
const governorAlphaAddress = require("../../../../governance/deployments/fork/GovernorAlpha.json").address
const { ethers, deployments } = hardhat
const { increaseTime } = require('../../../test/helpers/increaseTime')

async function run() {
    
    const gnosisSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')

    const poolToken = await ethers.getContractAt("Pool", poolAddress, gnosisSafe)
  


    // delegate to Lilly
    const delegationToLiliTx = await poolToken.delegate(employeeLiAddress)
    const delegateToLiliReceipt = await ethers.provider.getTransactionReceipt(delegationToLiliTx.hash)
    const delegateToLiliEvents = delegateToLiliReceipt.logs.map(log => { try { return poolToken.interface.parseLog(log) } catch (e) { return null } })

    green(`Delegated from ${delegateToLiliEvents[0].args.fromDelegate} to ${delegateToLiliEvents[0].args.toDelegate}`)

    // delegate to oneself
    dim(`delegating to self '0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f'`)
    const delegationSelfTx = await poolToken.delegate('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')
    const delegateToSelfReceipt = await ethers.provider.getTransactionReceipt(delegationSelfTx.hash)
    const delegateToSelfResultEvents = delegateToSelfReceipt.logs.map(log => { try { return poolToken.interface.parseLog(log) } catch (e) { return null } })
    
    green(`Delegated from ${delegateToSelfResultEvents[0].args.fromDelegate} to ${delegateToSelfResultEvents[0].args.toDelegate}`)


    // delegateBySig TODO

    console.log("moving forwards 1 year")
    await increaseTime(365 * 24 * 3600) // go 1 year forwards
    //claim from employeeB's treasuryVesting 
    const employeeBTreasury = await ethers.getContractAt("TreasuryVester", employeeBAddress, gnosisSafe)
    await employeeBTreasury.claim() // transfers half of total to emplyeB aaddress

    dim(`delegating to self for employeeB'`)
    const employeeBAccount = await ethers.provider.getUncheckedSigner('0xa38445311cCd04a54183CDd347E793F4D548Df3F') // employeeBcontrolledaddress
    const employeeBPoolToken = await ethers.getContractAt("Pool", poolAddress, employeeBAccount)
    
    const empoloyeeBDelegateToGnosisSafeTx = await employeeBPoolToken.delegate("0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f") // deletgate to gnosis safe
    const eGnosisSafeelegateToGnosisSafeReceipt = await ethers.provider.getTransactionReceipt(empoloyeeBDelegateToGnosisSafeTx.hash)
    const employeeBdelegateToGnosisSafeEvents = eGnosisSafeelegateToGnosisSafeReceipt.logs.map(log => { try { return poolToken.interface.parseLog(log) } catch (e) { return null } })
    green(`Delegated from ${employeeBdelegateToGnosisSafeEvents[0].args.fromDelegate} to ${employeeBdelegateToGnosisSafeEvents[0].args.toDelegate}`)


}
run()


