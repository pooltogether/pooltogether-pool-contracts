const { deploy1820 } = require('deploy-eip-1820')
const chalk = require('chalk')

function dim() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.dim.call(chalk, ...arguments))
  }
}

function cyan() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.cyan.call(chalk, ...arguments))
  }
}

function yellow() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.yellow.call(chalk, ...arguments))
  }
}

function green() {
  if (!process.env.HIDE_DEPLOY_LOG) {
    console.log(chalk.green.call(chalk, ...arguments))
  }
}

function displayResult(name, result) {
  if (!result.newlyDeployed) {
    yellow(`Re-used existing ${name} at ${result.address}`)
  } else {
    green(`${name} deployed at ${result.address}`)
  }
}

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
    admin,
    comptroller,
    sablier,
    reserveRegistry
  } = await getNamedAccounts()
  const chainId = parseInt(await getChainId(), 10)
  const isLocal = [1, 3, 4, 42, 77, 99].indexOf(chainId) == -1
  // 31337 is unit testing, 1337 is for coverage
  const isTestEnvironment = chainId === 31337 || chainId === 1337

  const signer = await ethers.provider.getSigner(deployer)

  dim("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
  dim("PoolTogether Pool Contracts - Deploy Script")
  dim("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n")

  const locus = isLocal ? 'local' : 'remote'
  dim(`network: ${chainName(chainId)} (${locus})`)
  dim(`deployer: ${deployer}`)
  if (!admin) {
    admin = signer._address
  }
  dim("admin:", admin)

  await deploy1820(signer)

  if (isLocal) {
    cyan("\nDeploying RNGService...")
    const rngServiceMockResult = await deploy("RNGServiceMock", {
      from: deployer
    })
    rng = rngServiceMockResult.address

    cyan("\nDeploying Dai...")
    const daiResult = await deploy("Dai", {
      args: [
        'DAI Test Token',
        'DAI'
      ],
      contract: 'ERC20Mintable',
      from: deployer
    })

    cyan("\nDeploying cDai...")
    // should be about 20% APR
    let supplyRate = '8888888888888'
    const cDaiResult = await deploy("cDai", {
      args: [
        daiResult.address,
        supplyRate
      ],
      contract: 'CTokenMock',
      from: deployer
    })

    await deploy("cDaiYieldSource", {
      args: [
        cDaiResult.address
      ],
      contract: "CTokenYieldSource",
      from: deployer,
      skipIfAlreadyDeployed: true
    })

    await deploy("yDai", {
      args: [
        daiResult.address
      ],
      contract: 'yVaultMock',
      from: deployer
    })

    // Display Contract Addresses
    dim("\nLocal Contract Deployments;\n")
    dim("  - RNGService:       ", rng)
    dim("  - Dai:              ", daiResult.address)
  }

  let comptrollerAddress = comptroller
  // if not set by named config
  cyan(`\nDeploying Comptroller...`)
  if (!comptrollerAddress) {
    const contract = isTestEnvironment ? 'ComptrollerHarness' : 'Comptroller'
    const comptrollerResult = await deploy("Comptroller", {
      contract,
      from: deployer
    })
    comptrollerAddress = comptrollerResult.address
    const comptrollerContract = await hardhat.ethers.getContractAt(
      "Comptroller",
      comptrollerResult.address,
      signer
    )
    if (admin !== deployer) {
      await comptrollerContract.transferOwnership(admin)
    }
    green(`Comptroller deployed at ${comptrollerAddress}`)
  } else {
    yellow(`Re-used existing Comptroller at ${comptrollerAddress}`)
  }

  cyan(`\nDeploying TokenFaucetProxyFactory...`)
  const tokenFaucetProxyFactoryResult = await deploy("TokenFaucetProxyFactory", {
    from: deployer
  })
  displayResult('TokenFaucetProxyFactory', tokenFaucetProxyFactoryResult)

  if (!reserveRegistry) {
    // if not set by named config
    cyan(`\nDeploying Reserve...`)
    const reserveResult = await deploy("Reserve", {
      from: deployer
    })
    displayResult('Reserve', reserveResult)

    const reserveContract = await hardhat.ethers.getContractAt(
      "Reserve",
      reserveResult.address,
      signer
    )
    if (admin !== deployer) {
      await reserveContract.transferOwnership(admin)
    }

    cyan(`\nDeploying ReserveRegistry...`)
    const reserveRegistryResult = await deploy("ReserveRegistry", {
      contract: 'Registry',
      from: deployer
    })
    displayResult('ReserveRegistry', reserveRegistryResult)

    const reserveRegistryContract = await hardhat.ethers.getContractAt(
      "Registry",
      reserveRegistryResult.address,
      signer
    )
    if (await reserveRegistryContract.lookup() != reserveResult.address) {
      await reserveRegistryContract.register(reserveResult.address)
    }
    if (admin !== deployer) {
      await reserveRegistryContract.transferOwnership(admin)
    }

    reserveRegistry = reserveRegistryResult.address
    green(`Created new reserve registry ${reserveRegistry}`)
  } else {
    yellow(`Using existing reserve registry ${reserveRegistry}`)
  }

  let permitAndDepositDaiResult
  cyan("\nDeploying PermitAndDepositDai...")
  permitAndDepositDaiResult = await deploy("PermitAndDepositDai", {
    from: deployer
  })
  displayResult('PermitAndDepositDai', permitAndDepositDaiResult)

  if (sablier) {
    cyan("\nDeploying SablierManager")
    let sablierManagerResult = await deploy("SablierManager", {
      from: deployer,
      args: [
        sablier
      ]
    })
    displayResult('SablierManager', sablierManagerResult)
  }

  cyan("\nDeploying CompoundPrizePoolProxyFactory...")
  let compoundPrizePoolProxyFactoryResult
  if (isTestEnvironment && !harnessDisabled) {
    compoundPrizePoolProxyFactoryResult = await deploy("CompoundPrizePoolProxyFactory", {
      contract: 'CompoundPrizePoolHarnessProxyFactory',
      from: deployer
    })
  } else {
    compoundPrizePoolProxyFactoryResult = await deploy("CompoundPrizePoolProxyFactory", {
      from: deployer
    })
  }
  displayResult('CompoundPrizePoolProxyFactory', compoundPrizePoolProxyFactoryResult)
  
  cyan("\nDeploying YieldSourcePrizePoolProxyFactory...")
  let yieldSourcePrizePoolProxyFactoryResult
  if (isTestEnvironment && !harnessDisabled) {
    yieldSourcePrizePoolProxyFactoryResult = await deploy("YieldSourcePrizePoolProxyFactory", {
      contract: 'YieldSourcePrizePoolHarnessProxyFactory',
      from: deployer,
      skipIfAlreadyDeployed: true
    })
  } else {
    yieldSourcePrizePoolProxyFactoryResult = await deploy("YieldSourcePrizePoolProxyFactory", {
      from: deployer,
      skipIfAlreadyDeployed: true
    })
  }
  displayResult('YieldSourcePrizePoolProxyFactory', yieldSourcePrizePoolProxyFactoryResult)

  cyan("\nDeploying ControlledTokenProxyFactory...")
  const controlledTokenProxyFactoryResult = await deploy("ControlledTokenProxyFactory", {
    from: deployer
  })
  displayResult('ControlledTokenProxyFactory', controlledTokenProxyFactoryResult)

  cyan("\nDeploying TicketProxyFactory...")
  const ticketProxyFactoryResult = await deploy("TicketProxyFactory", {
    from: deployer
  })
  displayResult('TicketProxyFactory', ticketProxyFactoryResult)
  
  let stakePrizePoolProxyFactoryResult
  if (isTestEnvironment && !harnessDisabled) {
    cyan("\nDeploying StakePrizePoolHarnessProxyFactory...")
    stakePrizePoolProxyFactoryResult = await deploy("StakePrizePoolProxyFactory", {
      contract: 'StakePrizePoolHarnessProxyFactory',
      from: deployer
    })
  }
  else{
    cyan("\nDeploying StakePrizePoolProxyFactory...")
    stakePrizePoolProxyFactoryResult = await deploy("StakePrizePoolProxyFactory", {
      from: deployer
    })
  }
  displayResult('StakePrizePoolProxyFactory', stakePrizePoolProxyFactoryResult)

  cyan("\nDeploying UnsafeTokenListenerDelegatorProxyFactory...")
  const unsafeTokenListenerDelegatorProxyFactoryResult = await deploy("UnsafeTokenListenerDelegatorProxyFactory", {
    from: deployer
  })
  displayResult('UnsafeTokenListenerDelegatorProxyFactory', unsafeTokenListenerDelegatorProxyFactoryResult)

  let multipleWinnersProxyFactoryResult
  cyan("\nDeploying MultipleWinnersProxyFactory...")
  if (isTestEnvironment && !harnessDisabled) {
    multipleWinnersProxyFactoryResult = await deploy("MultipleWinnersProxyFactory", {
      contract: 'MultipleWinnersHarnessProxyFactory',
      from: deployer
    })
  } else {
    multipleWinnersProxyFactoryResult = await deploy("MultipleWinnersProxyFactory", {
      from: deployer
    })
  }
  displayResult('MultipleWinnersProxyFactory', multipleWinnersProxyFactoryResult)

  cyan("\nDeploying SingleRandomWinnerProxyFactory...")
  const singleRandomWinnerProxyFactoryResult = await deploy("SingleRandomWinnerProxyFactory", {
    from: deployer
  })
  displayResult('SingleRandomWinnerProxyFactory', singleRandomWinnerProxyFactoryResult)

  cyan("\nDeploying ControlledTokenBuilder...")
  const controlledTokenBuilderResult = await deploy("ControlledTokenBuilder", {
    args: [
      controlledTokenProxyFactoryResult.address,
      ticketProxyFactoryResult.address
    ],
    from: deployer
  })
  displayResult('ControlledTokenBuilder', controlledTokenBuilderResult)

  cyan("\nDeploying MultipleWinnersBuilder...")
  const multipleWinnersBuilderResult = await deploy("MultipleWinnersBuilder", {
    args: [
      multipleWinnersProxyFactoryResult.address,
      controlledTokenBuilderResult.address,
    ],
    from: deployer
  })
  displayResult('MultipleWinnersBuilder', multipleWinnersBuilderResult)

  cyan("\nDeploying PoolWithMultipleWinnersBuilder...")
  const poolWithMultipleWinnersBuilderResult = await deploy("PoolWithMultipleWinnersBuilder", {
    args: [
      reserveRegistry,
      compoundPrizePoolProxyFactoryResult.address,
      yieldSourcePrizePoolProxyFactoryResult.address,
      stakePrizePoolProxyFactoryResult.address,
      multipleWinnersBuilderResult.address
    ],
    from: deployer
  })
  displayResult('PoolWithMultipleWinnersBuilder', poolWithMultipleWinnersBuilderResult)

  dim("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
  green("Contract Deployments Complete!")
  dim("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n")

};
