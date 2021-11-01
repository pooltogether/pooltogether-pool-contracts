const hardhat = require('hardhat')
const chalk = require("chalk")

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
    const { provider, utils } = ethers

    await hre.ethers.provider.send("hardhat_impersonateAccount",["0x42cd8312D2BCe04277dD5161832460e95b24262E"])
    const timelock = await provider.getUncheckedSigner('0x42cd8312D2BCe04277dD5161832460e95b24262E')

    await hre.ethers.provider.send("hardhat_impersonateAccount",["0xdf9eb223bafbe5c5271415c75aecd68c21fe3d7f"])
    const etherRichSigner = await provider.getUncheckedSigner('0xdf9eb223bafbe5c5271415c75aecd68c21fe3d7f')

    dim(`Sending 10 ether to ${timelock._address}...`)
    console.log("balance of ether rich: ", await ethers.provider.getBalance("0xdf9eb223bafbe5c5271415c75aecd68c21fe3d7f"))
    await etherRichSigner.sendTransaction({ to: timelock._address, value: ethers.utils.parseEther('10') })
    green(`sent!`)

    // now approve ERC20Predicate for all amounts 4,200 + 4,200 + 5000 = 13,400 POOL
    const ERC20PredicateContractAddress = "0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf"
    const poolTokenAddress = "0x0cec1a9154ff802e7934fc916ed7ca50bde6844e"

    const poolTokenContract = await ethers.getContractAt("ERC20Upgradeable", poolTokenAddress, timelock)
    await poolTokenContract.approve(ERC20PredicateContractAddress, ethers.utils.parseEther("13400"))
    console.log(ethers.utils.parseEther("13400").toString())
    green(`approved!`)

    const treasuryAddress ="0x21950E281bDE1714ffd1062ed17c56D4D8de2359"
    const treasuryContract = await ethers.getContractAt(treasuryAbi, treasuryAddress, timelock)
    await treasuryContract.claim()
    green(`claimed`)

    console.log((await poolTokenContract.balanceOf("0x42cd8312D2BCe04277dD5161832460e95b24262E")).toString())
    // now call depositFor() for each amount
    const rootChainManagerAddress ="0xA0c68C638235ee32657e8f720a23ceC1bFc77C77" 
    const rootChainManagerContract = await ethers.getContractAt(rootChainManagerImplementationAbi, rootChainManagerAddress, timelock)

    const usdcTokenFaucetAddress = "0x6cbc003fe015d753180f072d904ba841b2415498"
    const usdtTokenFaucetAddress = "0x12533c9fe479ab8c27e55c1b7697e0647fadb153"
    const safeAddress = "0xfaA08668FD52f74c09D4D3091E463ff736c5f269"

    const abiEncoder = ethers.utils.defaultAbiCoder


    const usdcAmount = utils.parseEther("4200")
    const encodedUSDCAmount = abiEncoder.encode(["uint256"], [usdcAmount])
    console.log("usdc")
    console.log(encodedUSDCAmount)

    await rootChainManagerContract.depositFor(usdcTokenFaucetAddress, poolTokenAddress, encodedUSDCAmount) // user, rootToken, depositData(abi encoded deposit amount)
    await rootChainManagerContract.depositFor(usdtTokenFaucetAddress, poolTokenAddress, encodedUSDCAmount) // user, rootToken, depositData(abi encoded deposit amount)

    const safeAmount = utils.parseEther("5000")

    const encodedSafeAmount = abiEncoder.encode(["uint256"], [safeAmount])
    console.log("safeamount")
    console.log(encodedSafeAmount)
    await rootChainManagerContract.depositFor(safeAddress, poolTokenAddress, encodedSafeAmount) // user, rootToken, depositData(encoded deposit amount)

    green(`done!`)

}
run()


const rootChainManagerProxyAbi = [{"inputs":[{"internalType":"address","name":"_proxyTo","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"_new","type":"address"},{"indexed":false,"internalType":"address","name":"_old","type":"address"}],"name":"ProxyOwnerUpdate","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"_new","type":"address"},{"indexed":true,"internalType":"address","name":"_old","type":"address"}],"name":"ProxyUpdated","type":"event"},{"stateMutability":"payable","type":"fallback"},{"inputs":[],"name":"implementation","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"proxyOwner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"proxyType","outputs":[{"internalType":"uint256","name":"proxyTypeId","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferProxyOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_newProxyTo","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"updateAndCall","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"_newProxyTo","type":"address"}],"name":"updateImplementation","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}]

const rootChainManagerImplementationAbi = [{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"userAddress","type":"address"},{"indexed":false,"internalType":"address payable","name":"relayerAddress","type":"address"},{"indexed":false,"internalType":"bytes","name":"functionSignature","type":"bytes"}],"name":"MetaTransactionExecuted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"tokenType","type":"bytes32"},{"indexed":true,"internalType":"address","name":"predicateAddress","type":"address"}],"name":"PredicateRegistered","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"rootToken","type":"address"},{"indexed":true,"internalType":"address","name":"childToken","type":"address"},{"indexed":true,"internalType":"bytes32","name":"tokenType","type":"bytes32"}],"name":"TokenMapped","type":"event"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEPOSIT","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ERC712_VERSION","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"ETHER_ADDRESS","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MAPPER_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MAP_TOKEN","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"checkpointManagerAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"childChainManagerAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"childToRootToken","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"rootToken","type":"address"},{"internalType":"address","name":"childToken","type":"address"}],"name":"cleanMapToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"depositEtherFor","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"address","name":"rootToken","type":"address"},{"internalType":"bytes","name":"depositData","type":"bytes"}],"name":"depositFor","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"userAddress","type":"address"},{"internalType":"bytes","name":"functionSignature","type":"bytes"},{"internalType":"bytes32","name":"sigR","type":"bytes32"},{"internalType":"bytes32","name":"sigS","type":"bytes32"},{"internalType":"uint8","name":"sigV","type":"uint8"}],"name":"executeMetaTransaction","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"bytes","name":"inputData","type":"bytes"}],"name":"exit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getChainId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getDomainSeperator","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getNonce","outputs":[{"internalType":"uint256","name":"nonce","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"getRoleMember","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleMemberCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_owner","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"initializeEIP712","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"rootToken","type":"address"},{"internalType":"address","name":"childToken","type":"address"},{"internalType":"bytes32","name":"tokenType","type":"bytes32"}],"name":"mapToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"processedExits","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"tokenType","type":"bytes32"},{"internalType":"address","name":"predicateAddress","type":"address"}],"name":"registerPredicate","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"rootToken","type":"address"},{"internalType":"address","name":"childToken","type":"address"},{"internalType":"bytes32","name":"tokenType","type":"bytes32"}],"name":"remapToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"rootToChildToken","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newCheckpointManager","type":"address"}],"name":"setCheckpointManager","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newChildChainManager","type":"address"}],"name":"setChildChainManagerAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newStateSender","type":"address"}],"name":"setStateSender","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"setupContractId","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"stateSenderAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"tokenToType","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"typeToPredicate","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"stateMutability":"payable","type":"receive"}]


const treasuryAbi = [{"inputs":[{"internalType":"address","name":"pool_","type":"address"},{"internalType":"address","name":"recipient_","type":"address"},{"internalType":"uint256","name":"vestingAmount_","type":"uint256"},{"internalType":"uint256","name":"vestingBegin_","type":"uint256"},{"internalType":"uint256","name":"vestingCliff_","type":"uint256"},{"internalType":"uint256","name":"vestingEnd_","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"constant":false,"inputs":[],"name":"claim","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"lastUpdate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"pool","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"recipient","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"recipient_","type":"address"}],"name":"setRecipient","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"vestingAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"vestingBegin","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"vestingCliff","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"vestingEnd","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}]