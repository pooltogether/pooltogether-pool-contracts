const assert = require('assert')

async function exec(provider, tx) {
  await provider.waitForTransaction(tx.hash)
  const receipt = await provider.getTransactionReceipt(tx.hash)
  assert.equal(receipt.status, '1')
}

module.exports = {
  exec
}
