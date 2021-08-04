const hardhat = require('hardhat')
const chalk = require("chalk")
const { runPoolDepositAndWithdraw } = require("../helpers/runPoolDepositAndWithdraw")

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function yellow() {
  console.log(chalk.yellow.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}

async function run() {
  const { ethers } = hardhat
  const { provider } = ethers

  await hre.ethers.provider.send("hardhat_impersonateAccount",["0x42cd8312D2BCe04277dD5161832460e95b24262E"])
  const timelock = await provider.getUncheckedSigner('0x42cd8312D2BCe04277dD5161832460e95b24262E')
  
  await hre.ethers.provider.send("hardhat_impersonateAccount",["0xdf9eb223bafbe5c5271415c75aecd68c21fe3d7f"])
  const etherRichSigner = await provider.getUncheckedSigner('0xdf9eb223bafbe5c5271415c75aecd68c21fe3d7f')
  
  dim(`Sending 10 ether to ${timelock._address}...`)
  console.log(await ethers.provider.getBalance("0xdf9eb223bafbe5c5271415c75aecd68c21fe3d7f"))
  await etherRichSigner.sendTransaction({ to: timelock._address, value: ethers.utils.parseEther('10') })
  green(`sent!`)

  const newTokenListeners = [  
      "0x9EE3FAECFFb7a02fC1696D3E7e672763C381dF3F", //COMP
      "0x4faD3ee8C696c2F1EcB238b3fA2F172D716bbbA6", //DAI
      "0xd9dcf282bDF21d4796e85ef2E64c2ccF42EB79E0", //POOL
      "0x51c6668557850d0D37A50eE2c9DfaAe0c2cba41C", // UNI
      "0x408c03C5c1440A0b0810acB6A9F7567Bee3c1314", //usdc
    ]

    // order matters
    const prizePools = [
      "0xBC82221e131c082336cf698F0cA3EBd18aFd4ce7", // comp - existing 0x72F06a78bbAac0489067A1973B0Cef61841D58BC (TokenFaucet)
      "0xEBfb47A7ad0FD6e57323C8A42B2E5A6a4F68fc1a", // dai - 0xf362ce295f2a4eae4348ffc8cdbce8d729ccb8eb
      "0x396b4489da692788e327e2e4b2b0459a5ef26791", // pool - 0x30430419b86e9512E6D93Fc2b0791d98DBeb637b (TokenFaucet)
      "0x0650d780292142835F6ac58dd8E2a336e87b4393", // uni - 0xa5dddefD30e234Be2Ac6FC1a0364cFD337aa0f61
      "0xde9ec95d7708b8319ccca4b8bc92c0a3b70bf416", // usdc - 0xBD537257fAd96e977b9E545bE583bbF7028F30b9
    ]

    const largeHolders = [
      "0x7587caefc8096f5f40acb83a09df031a018c66ec",//comp
      "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503", //dai
      "0x77383badb05049806d53e9def0c8128de0d56d90", //pool
      "0xf731A187cb77D278b817939Ce874741b074E3DE8",//"0xe3953d9d317b834592ab58ab2c7a6ad22b54075d", //uni
      "0x55fe002aeff02f77364de339a1292923a15844b8", //usdc
    ]

    let index = 0

    for await(const prizePool of prizePools){
      dim(`getting prize pool ${prizePool}`)

      await hre.ethers.provider.send("hardhat_impersonateAccount",[largeHolders[index]])
      const largeHolderSigner = await provider.getUncheckedSigner(largeHolders[index])

      const prizePoolContract = await ethers.getContractAt("CompoundPrizePool", prizePool, largeHolderSigner)
      const prizeStrategyAddress = await prizePoolContract.prizeStrategy()
      dim(`setting tokenListener for prizepool ${prizePool} strategy`)

      await hre.ethers.provider.send("hardhat_impersonateAccount",[timelock])
      const timelockSigner = await provider.getUncheckedSigner(timelock)
      await etherRichSigner.sendTransaction({ to:timelock, value: ethers.utils.parseEther('1') })
      const prizeStrategy = await ethers.getContractAt("MultipleWinners", prizeStrategyAddress, timelockSigner)

      await prizeStrategy.setTokenListener(newTokenListeners[index])
      green(`set tokenListener to ${newTokenListeners[index]}`)

      dim(`Sending ether to ${largeHolders[index]}`)
      await etherRichSigner.sendTransaction({ to: largeHolders[index], value: ethers.utils.parseEther('1') })
      green(`ether transfer successful`)
    
      dim(`now running thru lifecycle for ${prizePool} with ${largeHolderSigner._address}`)
      await runPoolDepositAndWithdraw(prizePoolContract, largeHolderSigner)
      index++
    }
    green(`done!`)
}
run()