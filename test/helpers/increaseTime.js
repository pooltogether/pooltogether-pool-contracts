const hardhat = require("hardhat")

async function increaseTime(time) {
  let provider = hardhat.ethers.provider
  await provider.send('evm_increaseTime', [ time ])
  await provider.send('evm_mine', [])
}

module.exports ={
  increaseTime
}