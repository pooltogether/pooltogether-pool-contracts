import buidler from "@nomiclabs/buidler"

export async function increaseTime(time: Number) {
  let provider = buidler.ethers.provider
  await provider.send('evm_increaseTime', [ time ])
  await provider.send('evm_mine', [])
}