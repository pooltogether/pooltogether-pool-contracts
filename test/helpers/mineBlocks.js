module.exports = async function(numberOfBlocks) {
  for (var i = 0; i < numberOfBlocks; i++) {
    await new Promise((resolve, reject) => {
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_mine'
      }, (err2, res) => {
        return err2 ? reject(err2) : resolve(res)
      })
    })
  }
}