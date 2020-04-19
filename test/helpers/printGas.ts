const buidler = require("@nomiclabs/buidler")
const chalk = require('chalk')

export async function printGas(transaction: any, name: string) {
  // console.log({ transaction })
  const tx = await transaction
  const receipt = (await buidler.ethers.provider.getTransactionReceipt(tx.hash))
  console.log(chalk.yellow(`${name}: ${receipt.gasUsed.toString()}`))
  return tx
}