const hardhat = require('hardhat')
const chalk = require("chalk")

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

const { ethers, deployments, getNamedAccounts } = hardhat

const alphaGovernanceAddress = require("../../../../governance/deployments/fork/GovernorAlpha.json").address
const treasuryVestingAddress = require("../../../../governance/deployments/fork/TreasuryVesterForTreasury.json").address
const timelockAddress = require("../../../../governance/deployments/fork/Timelock.json").address

const { increaseTime } = require('../../../test/helpers/increaseTime')

async function run() {
  

    const gnosisSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')
    const alphaGovernanceContract = await ethers.getContractAt("GovernorAlpha", alphaGovernanceAddress, gnosisSafe)
    const timelockContract = await ethers.getContractAt("Timelock", timelockAddress, gnosisSafe )
    
    // create a proposal to call claim() on Treasury Vestor
    const proposalAmount = await ethers.utils.parseEther("10")   
    const createProposalTx =   await alphaGovernanceContract.propose([treasuryVestingAddress], [proposalAmount], ["claim()"], [""], "call claim on TreasuryVesting contract")
    
    const createProposalReceipt = await ethers.provider.getTransactionReceipt(createProposalTx.hash)
    const createProposalEvents = createProposalReceipt.logs.map(log => { try { return alphaGovernanceContract.interface.parseLog(log) } catch (e) { return null } })
    dim("created proposal with id ", createProposalEvents[0].args.id)
    dim("created proposal with startBlock ", createProposalEvents[0].args.startBlock)
    dim("created proposal with endBlock ", createProposalEvents[0].args.endBlock)
    const proposalId =  createProposalEvents[0].args.id
    // see proposal state
    
     // const proposalId = ethers.BigNumber.from("1")
    // // Now vote on proposal, get above threshold
    dim("proposal state: ",await alphaGovernanceContract.state(proposalId.toString()))
    dim("Current block number ", (await ethers.provider.getBlock()).number)
    await increaseTime(30) // go at least once block fowards
    dim("Going fowards in time to block number ", (await ethers.provider.getBlock()).number)
    dim("proposal state: ",await alphaGovernanceContract.state(proposalId.toString()))
    dim("casting vote for proposal")
    await alphaGovernanceContract.castVote(proposalId, true)
    dim("fast forwarding 21 blocks")

    for(let counter=0; counter < 21;  counter++){
        await ethers.provider.send('evm_mine', [])
    }
    


    // await increaseTime(14 * 24 * 60 * 60) // go forward 2 weeks
    console.log("proposal state: ",await alphaGovernanceContract.state(proposalId.toString()))

    const currentBlock = await ethers.provider.getBlock()
    dim("currentBlock Number is ", currentBlock.number)


    // Queue proposal
    const queueProposalResult = await alphaGovernanceContract.queue(proposalId.toString())
    const queueProposalReceipt = await ethers.provider.getTransactionReceipt(queueProposalResult.hash)

    const queueProposalEvents = queueProposalReceipt.logs.map(log => { try { return alphaGovernanceContract.interface.parseLog(log) } catch (e) { return timelockContract.interface.parseLog(log) } })

    const eta = queueProposalEvents[1].args.eta

    dim("blockTimestamp is ", (await ethers.provider.getBlock()).timestamp)
    dim("eta for proposal is ",eta.toString())


    // now execute transaction
    dim("moving forwards 173000 seconds")
    await increaseTime(173000)
    dim("blockTimestamp is ", (await ethers.provider.getBlock()).timestamp)
    dim("eta for proposal is ",eta.toString())
    dim("proposal status is ", await alphaGovernanceContract.state(proposalId.toString()))
    const executeProposalResult = await alphaGovernanceContract.execute(proposalId.toString())


    green(`Finished executing proposals`)
    // Transfer event emmitted : receipient should be timelock --parse executeProposalResult


}
run()