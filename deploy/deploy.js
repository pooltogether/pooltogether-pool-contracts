const ProxyAdmin = require('../.build-openzeppelin/ProxyAdmin.json')
const ProxyFactory = require('../.build-openzeppelin/ProxyFactory.json')
const { deploy1820 } = require('deploy-eip-1820')
const Comptroller = require("../build/Comptroller.json")

const debug = require('debug')('ptv3:deploy.js')

const chainName = (chainId) => {
  switch(chainId) {
    case 1: return 'Mainnet';
    case 3: return 'Ropsten';
    case 4: return 'Rinkeby';
    case 5: return 'Goerli';
    case 42: return 'Kovan';
    case 31337: return 'BuidlerEVM';
    default: return 'Unknown';
  }
}

module.exports = async (buidler) => {
  const { getNamedAccounts, deployments, getChainId, ethers } = buidler
  const { deploy, getOrNull, save } = deployments

  const harnessDisabled = !!process.env.DISABLE_HARNESS

  let {
    deployer,
    rng,
    trustedForwarder,
    adminAccount
  } = await getNamedAccounts()
  const chainId = parseInt(await getChainId(), 10)
  const isLocal = [1, 3, 4, 42].indexOf(chainId) == -1
  // 31337 is unit testing, 1337 is for coverage
  const isTestEnvironment = chainId === 31337 || chainId === 1337
  let usingSignerAsAdmin = false
  const signer = await ethers.provider.getSigner(deployer)

  debug("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
  debug("PoolTogether Pool Contracts - Deploy Script")
  debug("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n")

  const locus = isLocal ? 'local' : 'remote'
  debug(`  Deploying to Network: ${chainName(chainId)} (${locus})`)

  if (!adminAccount) {
    debug("  Using deployer as adminAccount;")
    adminAccount = signer._address
    usingSignerAsAdmin = true
  }
  debug("\n  adminAccount:  ", adminAccount)

  await deploy1820(signer)

  debug("\n  Deploying ProxyAdmin...")
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

  debug("\n  Deploying ProxyFactory...")
  const proxyFactoryResult = await deploy("ProxyFactory", {
    contract: ProxyFactory,
    from: deployer,
    skipIfAlreadyDeployed: true
  });
  const proxyFactory = new ethers.Contract(proxyFactoryResult.address, ProxyFactory.abi, signer)

  if (isLocal) {
    debug("\n  Deploying TrustedForwarder...")
    const deployResult = await deploy("TrustedForwarder", {
      from: deployer,
      skipIfAlreadyDeployed: true
    });
    trustedForwarder = deployResult.address

    debug("\n  Deploying RNGService...")
    const rngServiceMockResult = await deploy("RNGServiceMock", {
      from: deployer,
      skipIfAlreadyDeployed: true
    })
    rng = rngServiceMockResult.address

    debug("\n  Deploying Dai...")
    const daiResult = await deploy("Dai", {
      args: [
        'DAI Test Token',
        'DAI'
      ],
      contract: 'ERC20Mintable',
      from: deployer,
      skipIfAlreadyDeployed: true
    })

    debug("\n  Deploying cDai...")
    // should be about 20% APR
    let supplyRate = '8888888888888'
    await deploy("cDai", {
      args: [
        daiResult.address,
        supplyRate
      ],
      contract: 'CTokenMock',
      from: deployer,
      skipIfAlreadyDeployed: true
    })

    await deploy("yDai", {
      args: [
        daiResult.address
      ],
      contract: 'yVaultMock',
      from: deployer,
      skipIfAlreadyDeployed: true
    })

    // Display Contract Addresses
    debug("\n  Local Contract Deployments;\n")
    debug("  - TrustedForwarder: ", trustedForwarder)
    debug("  - RNGService:       ", rng)
    debug("  - Dai:              ", daiResult.address)
  }

  const comptrollerImplementationResult = await deploy("ComptrollerImplementation", {
    contract: 'Comptroller',
    from: deployer,
    skipIfAlreadyDeployed: true
  })

  let comptrollerAddress
  if (isTestEnvironment) {
    const comptrollerResult = await deploy("Comptroller", {
      contract: 'ComptrollerHarness',
      from: deployer,
      skipIfAlreadyDeployed: true
    })
    const comptroller = await buidler.ethers.getContractAt(
      "Comptroller",
      comptrollerResult.address,
      signer
    )
    await comptroller.initialize(signer._address)
    comptrollerAddress = comptrollerResult.address
  } else {
    const comptrollerDeployment = await getOrNull("Comptroller")
    if (!comptrollerDeployment) {
      debug("\n  Deploying new Comptroller Proxy...")
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
  }

  debug("\n  Deploying CompoundPrizePoolProxyFactory...")
  let compoundPrizePoolProxyFactoryResult
  if (isTestEnvironment && !harnessDisabled) {
    compoundPrizePoolProxyFactoryResult = await deploy("CompoundPrizePoolProxyFactory", {
      contract: 'CompoundPrizePoolHarnessProxyFactory',
      from: deployer,
      skipIfAlreadyDeployed: true
    })
  } else {
    compoundPrizePoolProxyFactoryResult = await deploy("CompoundPrizePoolProxyFactory", {
      from: deployer,
      skipIfAlreadyDeployed: true
    })
  }

  let yVaultPrizePoolProxyFactoryResult
  if (isTestEnvironment && !harnessDisabled) {
    yVaultPrizePoolProxyFactoryResult = await deploy("yVaultPrizePoolProxyFactory", {
      contract: 'yVaultPrizePoolHarnessProxyFactory',
      from: deployer,
      skipIfAlreadyDeployed: true
    })
  } else {
    yVaultPrizePoolProxyFactoryResult = await deploy("yVaultPrizePoolProxyFactory", {
      from: deployer,
      skipIfAlreadyDeployed: true
    })
  }

  debug("\n  Deploying ControlledTokenProxyFactory...")
  const controlledTokenProxyFactoryResult = await deploy("ControlledTokenProxyFactory", {
    from: deployer,
    skipIfAlreadyDeployed: true
  })

  debug("\n  Deploying TicketProxyFactory...")
  const ticketProxyFactoryResult = await deploy("TicketProxyFactory", {
    from: deployer,
    skipIfAlreadyDeployed: true
  })

  debug("\n  Deploying StakePrizePoolProxyFactory...")
  const stakePrizePoolProxyFactoryResult = await deploy("StakePrizePoolProxyFactory", {
    from: deployer,
    skipIfAlreadyDeployed: true
  })

  debug("\n  Deploying SingleRandomWinnerProxyFactory...")
  let singleRandomWinnerProxyFactoryResult
  if (isTestEnvironment && !harnessDisabled) {
    singleRandomWinnerProxyFactoryResult = await deploy("SingleRandomWinnerProxyFactory", {
      contract: 'SingleRandomWinnerHarnessProxyFactory',
      from: deployer,
      skipIfAlreadyDeployed: true
    })
  } else {
    singleRandomWinnerProxyFactoryResult = await deploy("SingleRandomWinnerProxyFactory", {
      from: deployer,
      skipIfAlreadyDeployed: true
    })
  }

  debug("\n  Deploying SingleRandomWinnerBuilder...")
  const singleRandomWinnerBuilderResult = await deploy("SingleRandomWinnerBuilder", {
    args: [
      comptrollerAddress,
      singleRandomWinnerProxyFactoryResult.address,
      trustedForwarder,
      controlledTokenProxyFactoryResult.address,
      ticketProxyFactoryResult.address
    ],
    from: deployer,
    skipIfAlreadyDeployed: true
  })

  debug("\n  Deploying CompoundPrizePoolBuilder...")
  const compoundPrizePoolBuilderResult = await deploy("CompoundPrizePoolBuilder", {
    args: [
      comptrollerAddress,
      trustedForwarder,
      compoundPrizePoolProxyFactoryResult.address,
      singleRandomWinnerBuilderResult.address
    ],
    from: deployer,
    skipIfAlreadyDeployed: true
  })

  debug("\n  Deploying yVaultPrizePoolBuilder...")
  const yVaultPrizePoolBuilderResult = await deploy("yVaultPrizePoolBuilder", {
    args: [
      comptrollerAddress,
      trustedForwarder,
      yVaultPrizePoolProxyFactoryResult.address,
      singleRandomWinnerBuilderResult.address
    ],
    from: deployer,
    skipIfAlreadyDeployed: true
  })

  debug("\n  Deploying StakePrizePoolBuilder...")
  const stakePrizePoolBuilderResult = await deploy("StakePrizePoolBuilder", {
    args: [
      comptrollerAddress,
      trustedForwarder,
      stakePrizePoolProxyFactoryResult.address,
      singleRandomWinnerBuilderResult.address
    ],
    from: deployer,
    skipIfAlreadyDeployed: true
  })

  // Display Contract Addresses
  debug("\n  Contract Deployments Complete!\n")
  debug("  - ProxyFactory:                   ", proxyFactoryResult.address)
  debug("  - TicketProxyFactory:             ", ticketProxyFactoryResult.address)
  debug("  - ComptrollerImplementation:      ", comptrollerImplementationResult.address)
  debug("  - Comptroller:                    ", comptrollerAddress)
  debug("  - CompoundPrizePoolProxyFactory:  ", compoundPrizePoolProxyFactoryResult.address)
  debug("  - ControlledTokenProxyFactory:    ", controlledTokenProxyFactoryResult.address)
  debug("  - SingleRandomWinnerProxyFactory: ", singleRandomWinnerProxyFactoryResult.address)
  debug("  - SingleRandomWinnerBuilder:      ", singleRandomWinnerBuilderResult.address)
  debug("  - CompoundPrizePoolBuilder:       ", compoundPrizePoolBuilderResult.address)
  debug("  - yVaultPrizePoolBuilder:         ", yVaultPrizePoolBuilderResult.address)
  debug("  - StakePrizePoolBuilder:          ", stakePrizePoolBuilderResult.address)

  debug("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n")
};
