const remapping = {
  'Dai': 'ERC20Mintable',
  'cDai': 'CTokenMock',
  'yDai': 'yVaultMock'
}

module.exports = async function () {

  const d = await deployments.all()
  const signers = await ethers.getSigners()

  let deployedNames = Object.keys(d)

  const results = {}

  for (let i = 0; i < deployedNames.length; i++) {
    const deployedName = deployedNames[i]

    let contractName = deployedName
    if (remapping[deployedName]) {
      contractName = remapping[deployedName]
    }

    results[deployedName] = await ethers.getContractAt(contractName, d[deployedName].address, signers[0])
  }

  return results
}