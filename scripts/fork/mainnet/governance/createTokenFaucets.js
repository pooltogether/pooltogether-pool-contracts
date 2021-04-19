const hardhat = require('hardhat')
const chalk = require("chalk")
const {increaseTime} = require('../../../test/helpers/increaseTime')

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

const { ethers, deployments } = hardhat

async function getProxy(tx) { 
  const tokenFaucetProxyFactoryDeployment = await deployments.get('TokenFaucetProxyFactory')
  const gnosisSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')
  const tokenFaucetProxyFactory = await ethers.getContractAt('TokenFaucetProxyFactory', tokenFaucetProxyFactoryDeployment.address, gnosisSafe)
  const createResultReceipt = await ethers.provider.getTransactionReceipt(tx.hash)
  const createResultEvents = createResultReceipt.logs.map(log => { try { return tokenFaucetProxyFactory.interface.parseLog(log) } catch (e) { return null } })
  return createResultEvents[0].args.proxy
}

const pathToGovernanceRepo = (process.env.PATH_TO_GOVERNANCE_REPO).toString()
const requirePath = pathToGovernanceRepo + "/governance/deployments/fork/Pool.json"
const pool = require(requirePath).address

async function run() {
  const tokenFaucetProxyFactoryDeployment = await deployments.get('TokenFaucetProxyFactory')
  dim(`token faucet ${tokenFaucetProxyFactoryDeployment.address}`)
  dim(`pool address ${pool}`)
  
  const gnosisSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')
  const tokenFaucetProxyFactory = await ethers.getContractAt('TokenFaucetProxyFactory', tokenFaucetProxyFactoryDeployment.address, gnosisSafe)

  const poolToken = await ethers.getContractAt('IERC20Upgradeable', pool, gnosisSafe)
  // existing maninnet multiple winners addresses
  const daiPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0x178969A87a78597d303C47198c66F68E8be67Dc2', gnosisSafe)
  const usdcPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0x3d9946190907ada8b70381b25c71eb9adf5f9b7b', gnosisSafe)
  const uniPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0xe8726B85236a489a8E84C56c95790d07a368f913', gnosisSafe)

  dim(`Creating dai TokenFaucet...`)
  const daiDripAmount = ethers.utils.parseEther('225000')
  const daiDripRate = daiDripAmount.div(98 * 24 * 3600)
  const daiTicket = await daiPrizeStrategy.ticket()
  const createResultTx = await tokenFaucetProxyFactory.create(pool,daiTicket , daiDripRate)
  dim(`getting Dai TokenFaucet address `)
  const daiTokenFaucet = await getProxy(createResultTx)
  await daiPrizeStrategy.setTokenListener(daiTokenFaucet)
  green(`Created Dai TokenFaucet at ${daiTokenFaucet}!`)
  await poolToken.transfer(daiTokenFaucet, daiDripAmount)
  green(`Transferred ${daiDripAmount} to ${daiTokenFaucet}`)


  dim(`Creating usdc TokenFaucet...`)
  const usdcTokenFaucetTx = await tokenFaucetProxyFactory.create(pool, await usdcPrizeStrategy.ticket(), daiDripRate)
  dim(`Retrieving proxy...`)
  const usdcTokenFaucet = await getProxy(usdcTokenFaucetTx)
  dim(`Setting listener...`)
  await usdcPrizeStrategy.setTokenListener(usdcTokenFaucet)
  green(`Created usdc TokenFaucet at ${usdcTokenFaucet}!`)
  await poolToken.transfer(usdcTokenFaucet, daiDripAmount)
  green(`Transferred ${daiDripAmount} to ${usdcTokenFaucet}`)


  dim(`Creating uni TokenFaucet...`)
  const uniDripAmount = ethers.utils.parseEther('50000')
  const uniDripRate = uniDripAmount.div(98 * 24 * 3600)
  const uniTokenFaucetTx = await tokenFaucetProxyFactory.create(pool, await uniPrizeStrategy.ticket(), uniDripRate)
  const uniTokenFaucet = await getProxy(uniTokenFaucetTx)
  await uniPrizeStrategy.setTokenListener(uniTokenFaucet)
  green(`Created uni TokenFaucet at ${uniTokenFaucet}!`)
  await poolToken.transfer(uniTokenFaucet, uniDripAmount)
  green(`Transferred ${uniDripAmount} to ${uniTokenFaucet}`)

  green("balance of before claim : ", await poolToken.balanceOf("0x58f40a196d59a458a75478a2f9fc81ada5d5c710")) // address of an unlocked account holding ptDai
  dim(`moving 30 days forward in time`)
  await increaseTime(30 * 24 * 3600)
  const daiTokenFaucetContract = await ethers.getContractAt("TokenFaucet", daiTokenFaucet, gnosisSafe)
  const daiFaucetClaimResult = await daiTokenFaucetContract.claim("0x58f40a196d59a458a75478a2f9fc81ada5d5c710")
  green("balance of after claim : ", await poolToken.balanceOf("0x58f40a196d59a458a75478a2f9fc81ada5d5c710"))


}

run()