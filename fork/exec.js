const assert = require('assert')
const chalk = require('chalk')

async function exec(provider, txPromise) {
  let tx
  try {
    tx = await txPromise
    await provider.waitForTransaction(tx.hash)
    const receipt = await provider.getTransactionReceipt(tx.hash)
    assert.equal(receipt.status, '1')
  } catch (e) {
    console.error(chalk.red(`Could not process ${tx ? tx.hash : 'tx failed badly'}`))
    throw e
  }
}

module.exports = {
  exec
}
