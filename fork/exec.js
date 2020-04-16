const assert = require('assert')
const chalk = require('chalk')

async function exec(provider, txPromise) {
  let tx, receipt
  try {
    tx = await txPromise
    console.log(chalk.dim(`Transaction hash: ${tx.hash} @ ${tx.blockNumber}`), )
    await provider.waitForTransaction(tx.hash)
    receipt = await provider.getTransactionReceipt(tx.hash)
    assert.equal(receipt.status, '1')
  } catch (e) {
    console.error(chalk.red(`Could not process ${tx ? tx.hash : 'tx failed badly'}`))
    throw e
  }

  return {
    tx,
    receipt
  }
}

module.exports = {
  exec
}
