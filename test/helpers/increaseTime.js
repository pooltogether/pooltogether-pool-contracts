module.exports = async function(time) {
  await new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [time]
    }, (err2, res) => {
      return err2 ? reject(err2) : resolve(res)
    })
  })
}