const ProxyAdmin = require('@openzeppelin/upgrades/build/contracts/ProxyAdmin.json')
const ProxyFactory = require('@openzeppelin/upgrades/build/contracts/ProxyFactory.json')
const { deploy1820 } = require('deploy-eip-1820')
const buidler = require('@nomiclabs/buidler')
const ethers = buidler.ethers
const ERC20Mintable = require('../build/ERC20Mintable.json')
const Comptroller = require("../build/Comptroller.json")
const CTokenMock = require('../build/CTokenMock.json')

const debug = require('debug')('ptv3:deploy.js')

// const solcOutput = require('../cache/solc-output.json')

// function findMetadata(contractName) {
//   const contractNames = Object.keys(solcOutput.contracts)
//   const contractPath = contractNames.find(name => name.search(contractName) > -1)
//   return solcOutput.contracts[contractPath].metadata
// }

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
  const { deploy, getOrNull, save } = deployments;
  let {
    deployer,
    rng,
    trustedForwarder,
    adminAccount
  } = await getNamedAccounts()
  const chainId = await getChainId()
  const isLocal = [1, 3, 4, 42].indexOf(chainId) == -1
  let usingSignerAsAdmin = false
  const signer = await ethers.provider.getSigner(deployer)

  if (!adminAccount) {
    debug("Using deployer as adminAccount...")
    adminAccount = signer._address
    usingSignerAsAdmin = true
  }

  await deploy1820(signer)

  const proxyAdminResult = await deploy("ProxyAdmin", {
    contract: ProxyAdmin,
    from: deployer,
    skipIfAlreadyDeployed: true
  });

  const proxyAdmin = new ethers.Contract(proxyAdminResult.address, ProxyAdmin.abi, signer)
  if (await proxyAdmin.isOwner() && !usingSignerAsAdmin) {
    debug(`Transferring ProxyAdmin ownership to ${adminAccount}...`)
    await proxyAdmin.transferOwnership(adminAccount)
  }

  const proxyFactoryResult = await deploy("ProxyFactory", {
    contract: ProxyFactory,
    from: deployer,
    skipIfAlreadyDeployed: true
  });
  const proxyFactory = new ethers.Contract(proxyFactoryResult.address, ProxyFactory.abi, signer)

  if (isLocal) {
    const deployResult = await deploy("TrustedForwarder", {
      from: deployer,
      skipIfAlreadyDeployed: true
    });
    trustedForwarder = deployResult.address

    const rngServiceMockResult = await deploy("RNGServiceMock", {
      from: deployer,
      skipIfAlreadyDeployed: true
    })
    rng = rngServiceMockResult.address

    const daiResult = await deploy("Dai", {
      contract: ERC20Mintable,
      from: deployer,
      skipIfAlreadyDeployed: true
    })

    // should be about 20% APR
    let supplyRate = '8888888888888'
    await deploy("cDai", {
      args: [
        daiResult.address,
        supplyRate
      ],
      contract: CTokenMock,
      from: deployer,
      skipIfAlreadyDeployed: true
    })
  }
  
  const comptrollerImplementationResult = await deploy("ComptrollerImplementation", {
    contract: Comptroller,
    from: deployer,
    skipIfAlreadyDeployed: true
  })

  let comptrollerAddress
  const comptrollerDeployment = await getOrNull("Comptroller")
  if (!comptrollerDeployment) {
    debug("Deploying new Comptroller Proxy...")
    const salt = ethers.utils.hexlify(ethers.utils.randomBytes(32))

    // form initialize() data
    const comptrollerImpl = new ethers.Contract(comptrollerImplementationResult.address, Comptroller.abi, signer)
    const initTx = await comptrollerImpl.populateTransaction.initialize(adminAccount)

    // calculate the address
    comptrollerAddress = await proxyFactory.getDeploymentAddress(salt, signer._address)

    // deploy the proxy
    await proxyFactory.deploy(salt, comptrollerImplementationResult.address, proxyAdmin.address, initTx.data)

    await save("Comptroller", {
      ...comptrollerImplementationResult,
      address: comptrollerAddress
    })
  } else {
    comptrollerAddress = comptrollerDeployment.address
  }

  const compoundPrizePoolProxyFactoryResult = await deploy("CompoundPrizePoolProxyFactory", {
    from: deployer,
    skipIfAlreadyDeployed: true
  })
  
  const controlledTokenProxyFactoryResult = await deploy("ControlledTokenProxyFactory", {
    from: deployer,
    skipIfAlreadyDeployed: true
  })
  
  const prizeStrategyProxyFactoryResult = await deploy("PrizeStrategyProxyFactory", {
    from: deployer,
    skipIfAlreadyDeployed: true
  })

  await deploy("CompoundPrizePoolBuilder", {
    args: [
      comptrollerAddress,
      prizeStrategyProxyFactoryResult.address,
      trustedForwarder,
      compoundPrizePoolProxyFactoryResult.address,
      controlledTokenProxyFactoryResult.address,
      rng,
      proxyFactoryResult.address
    ],
    from: deployer,
    skipIfAlreadyDeployed: true
  })
};
