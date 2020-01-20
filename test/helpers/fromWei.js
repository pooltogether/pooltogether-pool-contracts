module.exports = function fromWei(weiString) {
  return web3.utils.fromWei(weiString, 'ether')
}