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

  const poolToken = await ethers.getContractAt()
  
  //function propose(address[] memory targets, uint[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description) public returns (uint) {
  



}
run()