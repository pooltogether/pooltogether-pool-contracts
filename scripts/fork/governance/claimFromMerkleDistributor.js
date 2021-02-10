const hardhat = require('hardhat')
const chalk = require("chalk")

function dim() {
  console.log(chalk.dim.call(chalk, ...arguments))
}

function green() {
  console.log(chalk.green.call(chalk, ...arguments))
}
const merkleDistributor = require("../../../../merkle-distributor/deployments/fork/MerkleDistributor.json").address
const poolAddress = require("../../../../governance/deployments/fork/Pool.json").address

const { ethers, deployments, getNamedAccounts } = hardhat

async function run() {
  

  const gnosisSafe = await ethers.provider.getUncheckedSigner('0x029Aa20Dcc15c022b1b61D420aaCf7f179A9C73f')

  const poolToken = await ethers.getContractAt('Pool', poolAddress, gnosisSafe)
  // check merkleDistbributor balance is non zero
  const poolBalanceOfMerkleDistributor = await poolToken.balanceOf(merkleDistributor)
  console.log("MerkleDistributor POOL balance ",poolBalanceOfMerkleDistributor.toString())

  // now make claim for unlocked account 0x9C6EFFf83578a1049E91106F071A24Ba5313B9e9
  const merkleDistributorContract = await ethers.getContractAt("MerkleDistributor", merkleDistributor, gnosisSafe)
  // from https://objective-jang-89749c.netlify.app/.netlify/functions/merkleAddressData?address=0x9C6EFFf83578a1049E91106F071A24Ba5313B9e9
  const proof = {"index":10228,"amount":"0x090a85f7962a9f5000",
  "proof":["0x6684cac9dc9e6e0ea6842b6e06dd9fd6b4a929e531c3c09118f18e18a2defe45","0xa15b9e53ad6baac140ff304449dafad9db8db0b38f392138614fbf0f1c5462e8",
  "0x40cce9e14806cf9e629124c95b4d961517c3acaf33d3884478cbb2d2c52cef9f","0xabd3a871ab21191d763e35c1d9b39458a91dc1fb95172c434c069763fbc78565",
  "0x2716d691414fc72e22dc3ac8dc534ea41e8cb5644f4a555d03078e876a811120","0xcd0042772eb842a0b22727dc6e5d6c1f2d83958f27172ce43760c12f4c220590",
  "0xe421fd2afce0e9fc42fb431308a9a2fb0b40f99401e4ce7fbff644e9fed60421","0xc687282ab4b430f4af4fbc1e78c1e65ab8b8a5b3b71146c160e4bebe507a4f2c",
  "0x51705dabc50964e507485eb7693116d87e0ddee4b387376c7884067b9d91c3d4","0x38f327019d848dcae373674edb221aaa5db7cb67962cf97f654c026893649e2b",
  "0x0e7eaebfc6e740c1dc75f9d2b905fdcab29946e57f24f3bda800cad2fb824bb8","0x0e68149d8c303cd1589ad309408c9ad290b38134bd02a76770d9c96e244f796f",
  "0xffda30e1353c6221b0fa72df5a35e79073b185d79fee59ca1bd4bb20a3906463","0xc7ebb116b642191179be9515d6bcb5fe427991cf14baf05961ea393bb4a087e3",
  "0x6e4d811f548750e6321070ff0f3529d106f7efacf77fb23218253119351d56a0"],
  "flags":{"isV1":false,"isV2_DAI":true,"isV2_USDC":false,"isV2_DAI_PODS":false,"isV2_USDC_PODS":false,"isV3_DAI":true,"isV3_UNI":false,"isV3_USDC":false,"isSnapshot":false}}
    
  const claimeeBalance = await poolToken.balanceOf("0x9C6EFFf83578a1049E91106F071A24Ba5313B9e9")

  if(!(await merkleDistributorContract.isClaimed(proof.index))){
    //claim(uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof) 
    const claimResult = await merkleDistributorContract.claim(proof.index,"0x9C6EFFf83578a1049E91106F071A24Ba5313B9e9", proof.amount, proof.proof)
    const updatedClaimeeBalance = await poolToken.balanceOf("0x9C6EFFf83578a1049E91106F071A24Ba5313B9e9")
    green(`claimed: ${updatedClaimeeBalance.toString()}`)
  }
  else{
    dim("this index has already claimed")
  }


  green("claimee balance ", claimeeBalance)

}

run()
