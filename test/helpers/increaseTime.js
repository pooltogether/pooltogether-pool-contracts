const buidler = require("@nomiclabs/buidler")

async function increaseTime(time) {
  let provider = buidler.ethers.provider
  await provider.send('evm_increaseTime', [ time ])
  await provider.send('evm_mine', [])
}

module.exports ={
  increaseTime
}