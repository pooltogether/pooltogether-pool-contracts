import buidler from "@nomiclabs/buidler"

export async function increaseTime(time: Number) {
  // let startBlock = await buidler.ethers.provider.getBlock('latest')
  // console.log(`Starting time: ${startBlock.timestamp}, adding ${time}`)
  let provider = buidler.ethers.provider
  await provider.send('evm_increaseTime', [ time ])
  await provider.send('evm_mine', [])
  // let endBlock = await buidler.ethers.provider.getBlock('latest')
  // console.log(`Ending time:   ${endBlock.timestamp}`)
}