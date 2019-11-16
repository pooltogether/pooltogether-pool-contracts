const chai = require('chai')
const expect = chai.expect
const shell = require('shelljs')
const MultisigAbi = require('./GnosisMultisigAbi')
const top50Addresses = require('./top50Addresses')

provider.pollingInterval = 500

function sleep(ms){
  return new Promise(resolve=>{
      setTimeout(resolve,ms)
  })
}

async function run () {
  expect(networkConfig.proxies["pooltogether/Pool"][0].implementation).to.equal('0xaf1610D242c7CdD30c546844aF75c147C12e94F9')

  const binanceAddress = '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8'
  const admin = '0x567fb0238d73fcF4DB40C3BD83433b9a39284CaE'

  console.log('Balance of Binance: ', (await provider.getBalance(binanceAddress)).toString())

  // Binance 7 account, send the deployer eth
  let binance = provider.getSigner(binanceAddress)
  let binTx = await binance.sendTransaction({ to: admin, value: ethers.utils.parseEther('100') })
  await provider.waitForTransaction(binTx.hash)

  console.log('Deployer balance: ', ethers.utils.formatEther((await provider.getBalance(admin)).toString()))

  console.log('Deployer balance: ', ethers.utils.formatEther((await provider.getBalance(admin)).toString()))

  const response = shell.exec(`oz push --network mainnet --force --from ${admin}`)
  if (response.code !== 0) {
    throw new Error('Unable to push contracts: ', response)
  }

  let poolProxyAddress = '0xb7896fce748396EcFC240F5a0d3Cc92ca42D7d84'

  let newNetworkConfig = loadNetworkConfig()
  const newPoolAddress = newNetworkConfig.contracts.Pool.address
  expect(newPoolAddress).to.not.equal('0xaf1610D242c7CdD30c546844aF75c147C12e94F9')

  let admin1 = '0xa38445311cCd04a54183CDd347E793F4D548Df3F'
  let admin2 = '0xed4B4AA039Cbb8A1A125cEB955765D8908E1D4c1'

  let signer1 = provider.getSigner(admin1)
  let signer2 = provider.getSigner(admin2)

  const multisig = '0x98eA2D8438f70cE876c2Db26Fc494CfeD10b4cd7'

  const ms1 = new ethers.Contract(multisig, MultisigAbi, signer1)
  const ms2 = new ethers.Contract(multisig, MultisigAbi, signer2)

  const startTxId = (await ms1.transactionCount()).toString()

  // console.log(Object.keys(artifacts))
  // console.log(Object.keys(contracts))
  // console.log(Object.keys(interfaces))
  const initBasePoolUpgradeData = interfaces.Pool.functions.initBasePoolUpgrade.encode(['Pool Sai', 'plSAI', []])
  const upgradeAndCallData = interfaces.ProxyAdmin.functions.upgradeAndCall.encode([poolProxyAddress, newPoolAddress, initBasePoolUpgradeData])

  // console.log('admin1 is owner: ', await ms1.isOwner(admin1))
  // console.log('admin1 balance: ', (await provider.getBalance(admin1)).toString())

  const submitTx = await ms1.submitTransaction(contracts.ProxyAdmin.address, 0, upgradeAndCallData)
  const submitReceipt = await provider.waitForTransaction(submitTx.hash)

  const lastTxId = parseInt((await ms1.transactionCount()).toString())

  // have the second signer confirm
  const confirmTx = await ms2.confirmTransaction(lastTxId-1, { gasLimit: 800000 })
  const confirmReceipt = await provider.waitForTransaction(confirmTx.hash)

  // Check that the upgrade was successful
  expect(await contracts.ProxyAdmin.getProxyImplementation(poolProxyAddress)).to.equal(newPoolAddress)

  // The contract is now upgraded

  // Now ensure we can withdraw

  for (let i = 0; i < top50Addresses.length; i++) {
    let address = top50Addresses[0]
    // Make sure they have enough ether
    let binTx2 = await binance.sendTransaction({ to: address, value: ethers.utils.parseEther('1') })
    await provider.waitForTransaction(binTx2.hash)
    let signer = provider.getSigner(address)
    let pool = new ethers.Contract(contracts.Pool.address, artifacts.Pool.abi, signer)
    let openBalance = ethers.utils.formatEther(await pool.openBalanceOf(address))
    let balance = ethers.utils.formatEther(await pool.balanceOf(address))
    console.log(`${address} is withdrawing ${balance} and open balance ${openBalance}`)
    let tx = await pool.withdraw()
    console.log('withdraw tx: ', tx)
    let txRec
    while (txRec == null) {
      txRec = await provider.getTransactionReceipt(tx.hash)
      await sleep(1000)
    }
    console.log('received ', txRec)
  }
}

run().then(() => {
  console.log("Done.")
})
