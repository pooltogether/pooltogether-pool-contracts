const buidler = require('@nomiclabs/buidler')
const chalk = require("chalk")

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

const { ethers, deployments, getNamedAccounts } = buidler

const alphaGovernanceAddress = require("../../../../governance/deployments/fork/GovernorAlpha.json").address
const treasuryVestingAddress = require("../../../../governance/deployments/fork/TreasuryVesterForTreasury.json").address
const poolAddress = require("../../../../governance/deployments/fork/Pool.json").address
const { increaseTime } = require('../../../test/helpers/increaseTime')

async function run() {
  

    const gnosisSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')

    const poolToken = await ethers.getContractAt("Pool", poolAddress, gnosisSafe)
    const treasuryVestingContract = await ethers.getContractAt("TreasuryVester", treasuryVestingAddress, gnosisSafe)
    const alphaGovernanceContract = await ethers.getContractAt("GovernorAlpha", alphaGovernanceAddress, gnosisSafe)


    // console.log("PriorVotes is : ",(await poolToken.getPriorVotes("0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f", currentBlock.number - 1))

    // create a proposal to call claim() on Treasury Vestor

    //function propose(address[] memory targets, uint[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description) public returns (uint) {
    const claimFunctionFragment = treasuryVestingContract.interface.functions['claim()']
    const claimFunctionSelector = treasuryVestingContract.interface.getSighash(claimFunctionFragment)
    const proposalAmount = await ethers.utils.parseEther("10")
    const createProposalTx =   await alphaGovernanceContract.propose([treasuryVestingAddress], [proposalAmount], [claimFunctionSelector], ["0x"], "call claim on TreasuryVesting contract")
    
    
    const createProposalReceipt = await ethers.provider.getTransactionReceipt(createProposalTx.hash)
    const createProposalEvents = createProposalReceipt.logs.map(log => { try { return alphaGovernanceContract.interface.parseLog(log) } catch (e) { return null } })
    console.log("created proposal with id ", createProposalEvents[0].args.id) ``
    const proposalId =  createProposalEvents[0].args.id
    // see proposal state
    
    // const proposalId = ethers.BigNumber.from("1")
    // Now vote on proposal, get above threshold
    console.log("proposal state: ",await alphaGovernanceContract.state(proposalId.toString()))
    console.log("Current block number ", (await ethers.provider.getBlock()).number)
    await increaseTime(30) // go at least once block fowards
    console.log("Going fowards in time to block number ", (await ethers.provider.getBlock()).number)
    console.log("proposal state: ",await alphaGovernanceContract.state(proposalId.toString()))
    console.log("casting vote for proposal")
    await alphaGovernanceContract.castVote(proposalId, true)
    console.log("fast forwarding 2 weeks")
    await increaseTime(14 * 24 * 60 * 60) // go forward 2 weeks
    console.log("proposal state: ",await alphaGovernanceContract.state(proposalId.toString()))

    


    //fast forward time
    
    
    // Transfer event emmitted : receipient should be timelock


}
run()