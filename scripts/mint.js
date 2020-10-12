const buidler = require('@nomiclabs/buidler')

const loadContracts = require('./loadContracts')

async function run () { 
  const signers = await buidler.ethers.getSigners()

  const {
    CompoundPrizePoolBuilder,
    SingleRandomWinnerBuilder,
    RNGServiceMock,
    Dai,
    cDai
  } = await loadContracts()

  console.log(`CompoundPrizePoolBuilder: ${CompoundPrizePoolBuilder.address}`)
  console.log(`SingleRandomWinnerBuilder: ${SingleRandomWinnerBuilder.address}`)
  console.log(`RNGServiceMock: ${RNGServiceMock.address}`)

  for (let i = 0; i < signers.length; i++) {
    if (signers[i]) {
      let amount = '10000'
      console.log(`Minting ${amount} Dai(${Dai.address}) to ${signers[i]._address}...`)
      await Dai.mint(signers[i]._address, ethers.utils.parseEther(amount))

      let cDaiAmount = '1000'
      console.log(`Depositing ${cDaiAmount} into cDai(${cDai.address})`)
      await Dai.connect(signers[i]).approve(cDai.address, ethers.utils.parseEther(cDaiAmount))
      await cDai.connect(signers[i]).mint(ethers.utils.parseEther(cDaiAmount))
    }
  }
}

run()