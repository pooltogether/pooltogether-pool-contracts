const hardhat = require('hardhat')
const chalk = require("chalk")

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

const { ethers, deployments, getNamedAccounts } = hardhat

async function getProxy(tx) { 
  const tokenFaucetProxyFactoryDeployment = await deployments.get('TokenFaucetProxyFactory')
  const gnosisSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')
  const tokenFaucetProxyFactory = await ethers.getContractAt('TokenFaucetProxyFactory', tokenFaucetProxyFactoryDeployment.address, gnosisSafe)
  const createResultReceipt = await ethers.provider.getTransactionReceipt(tx.hash)
  const createResultEvents = createResultReceipt.logs.map(log => { try { return tokenFaucetProxyFactory.interface.parseLog(log) } catch (e) { return null } })
  return createResultEvents[0].args.proxy
}

async function run() {
  const { pool } = await getNamedAccounts()

  const tokenFaucetProxyFactoryDeployment = await deployments.get('TokenFaucetProxyFactory')
  const treasurySafe = await ethers.provider.getUncheckedSigner('0x77383BaDb05049806d53e9def0C8128de0D56D90')
  const gnosisSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')
  const tokenFaucetProxyFactory = await ethers.getContractAt('TokenFaucetProxyFactory', tokenFaucetProxyFactoryDeployment.address, gnosisSafe)
  
  const poolToken = await ethers.getContractAt('IERC20Upgradeable', pool, treasurySafe)
  const daiPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0x178969A87a78597d303C47198c66F68E8be67Dc2', gnosisSafe)
  const uniPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0xe8726B85236a489a8E84C56c95790d07a368f913', gnosisSafe)
  const usdcPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0x3d9946190907ada8b70381b25c71eb9adf5f9b7b', gnosisSafe)
  const compPrizeStrategy = await ethers.getContractAt('MultipleWinners', '0x3ec4694b65e41f12d6b5d5ba7c2341f4d6859773', gnosisSafe)

  dim(`Creating dai TokenFaucet...`)
  const daiDripAmount = ethers.utils.parseEther('225000')
  const daiDripRate = daiDripAmount.div(98 * 24 * 3600)
  const createResultTx = await tokenFaucetProxyFactory.create(pool, await daiPrizeStrategy.ticket(), daiDripRate)
  const daiTokenFaucet = await getProxy(createResultTx)
  await daiPrizeStrategy.setTokenListener(daiTokenFaucet)
  green(`Created TokenFaucet at ${daiTokenFaucet}!`)
  await poolToken.transfer(daiTokenFaucet, daiDripAmount)

  dim(`Creating usdc TokenFaucet...`)
  const usdcTokenFaucetTx = await tokenFaucetProxyFactory.create(pool, await usdcPrizeStrategy.ticket(), daiDripRate)
  const usdcTokenFaucet = await getProxy(usdcTokenFaucetTx)
  await usdcPrizeStrategy.setTokenListener(usdcTokenFaucet)
  green(`Created usdc TokenFaucet at ${usdcTokenFaucet}!`)
  await poolToken.transfer(usdcTokenFaucet, daiDripAmount)

  dim(`Creating uni TokenFaucet...`)
  const uniDripAmount = ethers.utils.parseEther('25000')
  const uniDripRate = uniDripAmount.div(98 * 24 * 3600)
  const uniTokenFaucetTx = await tokenFaucetProxyFactory.create(pool, await uniPrizeStrategy.ticket(), uniDripRate)
  const uniTokenFaucet = await getProxy(uniTokenFaucetTx)
  await uniPrizeStrategy.setTokenListener(uniTokenFaucet)
  green(`Created uni TokenFaucet at ${uniTokenFaucet}!`)
  await poolToken.transfer(uniTokenFaucet, uniDripAmount)

  dim(`Creating COMP TokenFaucet...`)
  const compDripAmount = ethers.utils.parseEther('25000')
  const compDripRate = compDripAmount.div(98 * 24 * 3600)
  const compTokenFaucetTx = await tokenFaucetProxyFactory.create(pool, await compPrizeStrategy.ticket(), compDripRate)
  const compTokenFaucet = await getProxy(compTokenFaucetTx)
  await compPrizeStrategy.setTokenListener(compTokenFaucet)
  green(`Created comp TokenFaucet at ${compTokenFaucet}!`)
  await poolToken.transfer(compTokenFaucet, compDripAmount)

}

run()
