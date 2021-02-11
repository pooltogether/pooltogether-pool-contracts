const { deploy1820 } = require('deploy-eip-1820')

const debug = require('debug')('ptv3:deploy.js')

const chainName = (chainId) => {
  switch(chainId) {
    case 1: return 'Mainnet';
    case 3: return 'Ropsten';
    case 4: return 'Rinkeby';
    case 5: return 'Goerli';
    case 42: return 'Kovan';
    case 31337: return 'HardhatEVM';
    default: return 'Unknown';
  }
}

module.exports = async (hardhat) => {
  const { getNamedAccounts, deployments, getChainId, ethers } = hardhat
  const { deploy } = deployments

  const harnessDisabled = !!process.env.DISABLE_HARNESS

  let {
    deployer,
    rng,
    adminAccount,
    comptroller,
    reserveRegistry
  } = await getNamedAccounts()
  const chainId = parseInt(await getChainId(), 10)
  const isLocal = [1, 3, 4, 42].indexOf(chainId) == -1
  // 31337 is unit testing, 1337 is for coverage
  const isTestEnvironment = chainId === 31337 || chainId === 1337
  const signer = await ethers.provider.getSigner(deployer)

  debug("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
  debug("PoolTogether Pool Contracts - Deploy Script")
  debug("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n")

  const locus = isLocal ? 'local' : 'remote'
  debug(`  Deploying to Network: ${chainName(chainId)} (${locus})`)

  if (!adminAccount) {
    debug("  Using deployer as adminAccount;")
    adminAccount = signer._address
  }
  debug("\n  adminAccount:  ", adminAccount)

  await deploy1820(signer)

  if (isLocal) {
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
    debug("  - RNGService:       ", rng)
    debug("  - Dai:              ", daiResult.address)
  }

  let comptrollerAddress = comptroller
  // if not set by named config
  if (!comptrollerAddress) {
    const contract = isTestEnvironment ? 'ComptrollerHarness' : 'Comptroller'
    const comptrollerResult = await deploy("Comptroller", {
      contract,
      from: deployer,
      skipIfAlreadyDeployed: true
    })
    comptrollerAddress = comptrollerResult.address
    const comptrollerContract = await hardhat.ethers.getContractAt(
      "Comptroller",
      comptrollerResult.address,
      signer
    )
    if (adminAccount !== deployer) {
      await comptrollerContract.transferOwnership(adminAccount)
    }
    debug(`  Created new comptroller ${comptrollerAddress}`)
  } else {
    debug(`  Using existing comptroller ${comptrollerAddress}`)
  }

  const tokenFaucetProxyFactoryResult = await deploy("TokenFaucetProxyFactory", {
    from: deployer,
    skipIfAlreadyDeployed: true
  })

  if (!reserveRegistry) {
    // if not set by named config
    const reserveResult = await deploy("Reserve", {
      from: deployer,
      skipIfAlreadyDeployed: true
    })
    const reserveContract = await hardhat.ethers.getContractAt(
      "Reserve",
      reserveResult.address,
      signer
    )
    if (adminAccount !== deployer) {
      await reserveContract.transferOwnership(adminAccount)
    }

    const reserveRegistryResult = await deploy("ReserveRegistry", {
      contract: 'Registry',
      from: deployer,
      skipIfAlreadyDeployed: true
    })
    const reserveRegistryContract = await hardhat.ethers.getContractAt(
      "Registry",
      reserveRegistryResult.address,
      signer
    )
    if (await reserveRegistryContract.lookup() != reserveResult.address) {
      await reserveRegistryContract.register(reserveResult.address)
    }
    if (adminAccount !== deployer) {
      await reserveRegistryContract.transferOwnership(adminAccount)
    }

    reserveRegistry = reserveRegistryResult.address
    debug(`  Created new reserve registry ${reserveRegistry}`)
  } else {
    debug(`  Using existing reserve registry ${reserveRegistry}`)
  }

  let permitAndDepositDaiResult
  debug("\n  Deploying PermitAndDepositDai...")
  permitAndDepositDaiResult = await deploy("PermitAndDepositDai", {
    from: deployer,
    skipIfAlreadyDeployed: true
  })

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
  let stakePrizePoolProxyFactoryResult
  if (isTestEnvironment && !harnessDisabled) {
    stakePrizePoolProxyFactoryResult = await deploy("StakePrizePoolProxyFactory", {
      contract: 'StakePrizePoolHarnessProxyFactory',
      from: deployer,
      skipIfAlreadyDeployed: true
    })
  }
  else{
    stakePrizePoolProxyFactoryResult = await deploy("StakePrizePoolProxyFactory", {
      from: deployer,
      skipIfAlreadyDeployed: true
    })
  }

  debug("\n  Deploying UnsafeTokenListenerDelegatorProxyFactory...")
  const unsafeTokenListenerDelegatorProxyFactoryResult = await deploy("UnsafeTokenListenerDelegatorProxyFactory", {
    from: deployer,
    skipIfAlreadyDeployed: true
  })

  let multipleWinnersProxyFactoryResult
  debug("\n  Deploying MultipleWinnersProxyFactory...")
  if (isTestEnvironment && !harnessDisabled) {
    multipleWinnersProxyFactoryResult = await deploy("MultipleWinnersProxyFactory", {
      contract: 'MultipleWinnersHarnessProxyFactory',
      from: deployer,
      skipIfAlreadyDeployed: true
    })
  } else {
    multipleWinnersProxyFactoryResult = await deploy("MultipleWinnersProxyFactory", {
      from: deployer,
      skipIfAlreadyDeployed: true
    })
  }

  debug("\n  Deploying SingleRandomWinnerProxyFactory...")
  const singleRandomWinnerProxyFactoryResult = await deploy("SingleRandomWinnerProxyFactory", {
    from: deployer,
    skipIfAlreadyDeployed: true
  })

  debug("\n  Deploying ControlledTokenBuilder...")
  const controlledTokenBuilderResult = await deploy("ControlledTokenBuilder", {
    args: [
      controlledTokenProxyFactoryResult.address,
      ticketProxyFactoryResult.address
    ],
    from: deployer,
    skipIfAlreadyDeployed: true
  })

  debug("\n  Deploying MultipleWinnersBuilder...")
  const multipleWinnersBuilderResult = await deploy("MultipleWinnersBuilder", {
    args: [
      multipleWinnersProxyFactoryResult.address,
      controlledTokenBuilderResult.address,
    ],
    from: deployer,
    skipIfAlreadyDeployed: true
  })

  debug("\n  Deploying PoolWithMultipleWinnersBuilder...")
  const poolWithMultipleWinnersBuilderResult = await deploy("PoolWithMultipleWinnersBuilder", {
    args: [
      reserveRegistry,
      compoundPrizePoolProxyFactoryResult.address,
      stakePrizePoolProxyFactoryResult.address,
      multipleWinnersBuilderResult.address
    ],
    from: deployer,
    skipIfAlreadyDeployed: true
  })

  // Display Contract Addresses
  debug("\n  Contract Deployments Complete!\n")
  debug("  - TicketProxyFactory:             ", ticketProxyFactoryResult.address)
  debug("  - Reserve Registry:               ", reserveRegistry)
  debug("  - Comptroller:                    ", comptrollerAddress)
  debug("  - TokenFaucetProxyFactory:      ", tokenFaucetProxyFactoryResult.address)
  debug("  - UnsafeTokenListenerDelegatorProxyFactory ", unsafeTokenListenerDelegatorProxyFactoryResult.address)
  debug("  - CompoundPrizePoolProxyFactory:  ", compoundPrizePoolProxyFactoryResult.address)
  debug("  - StakePrizePoolProxyFactory:     ", stakePrizePoolProxyFactoryResult.address)
  debug("  - SingleRandomWinnerProxyFactory  ", singleRandomWinnerProxyFactoryResult.address)
  debug("  - ControlledTokenProxyFactory:    ", controlledTokenProxyFactoryResult.address)
  debug("  - ControlledTokenBuilder:         ", controlledTokenBuilderResult.address)
  debug("  - MultipleWinnersBuilder:         ", multipleWinnersBuilderResult.address)
  debug("  - PoolWithMultipleWinnersBuilder: ", poolWithMultipleWinnersBuilderResult.address)
  if (permitAndDepositDaiResult) {
    debug("  - PermitAndDepositDai:            ", permitAndDepositDaiResult.address)
  }

  debug("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n")
};
