module.exports = function toWei(etherString) {
  return web3.utils.toWei(etherString, 'ether')
}