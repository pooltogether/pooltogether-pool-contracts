# PoolTogether Prize Savings Protocol

[![Coverage Status](https://coveralls.io/repos/github/pooltogether/pooltogether-contracts/badge.svg?branch=version-3)](https://coveralls.io/github/pooltogether/pooltogether-contracts?branch=version-3)
[![built-with openzeppelin](https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF)](https://docs.openzeppelin.com/)

The [PoolTogether](https://www.pooltogether.com/) Prize Savings Protocol Ethereum smart contracts.

See the [API documentation](https://docs.pooltogether.com/)

# Usage

If you need an ABI or to depend on the contracts, you can use NPM:

```bash
$ yarn add @pooltogether/pooltogether-contracts@alpha
```

Notice the `alpha` tag: this is important!  Otherwise you'll get the old code.

# Integration Tests

If you're building against PoolTogether and want to deploy all of the factories and builders to your test rpc, you can use the `deployContracts` function.

Like so:

```javascript
#!/usr/bin/env node

const ethers = require('ethers')
const { deployContracts } = require('@pooltogether/pooltogether-contracts')
const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545')
// This address is the first address in Buidler (https://buidler.dev)
const signer = provider.getSigner('0xc783df8a850f42e7f7e57013759c285caa701eb6')

let contracts = await deployContracts(signer)

/**
 * 
 * The resuling object fields will include:
 * 
  rng: The RNG Service
  registry: The ERC1820Registry
  forwarder: A OpenGSN TrustedForwarder instance
  token: An ERC20Mintable asset token
  cToken: A Mock Compount cToken for the asset
  governor: A Mock governor instance
  ownableModuleManagerFactory: factory 
  yieldServiceFactory: factory
  prizePoolFactory: factory
  timelockFactory: factory
  ticketFactory: factory
  prizeStrategyFactory: factory
  loyaltyFactory: factory
  sponsorshipFactory: factory
  prizePoolBuilder: The PrizePool builder
  singleRandomWinnerPrizePoolBuilder: The SingleRandomWinner prize pool builder 
 * 
 */
```

# Development

First clone this repository and enter the directory.

Install dependencies:

```
$ yarn
```

Copy over .envrc and allow [direnv](https://direnv.net/):

```
$ cp .envrc.example .envrc
$ direnv allow
```

## Deploy Locally

First start the local node:

```bash
$ yarn start
```

Now deploy the contracts:

```bash
$ yarn migrate-local
```

Deploy a mock cToken contract:

```bash
$ yarn deploy-ctoken-local
```

Interact with the contracts on the command line using [oz-console](https://github.com/pooltogether/oz-console):

```bash
$ yarn console-local
local> contracts.SingleRandomWinnerPrizePoolBuilder.address
```

To give test eth to an account, use the console:

```bash
$ yarn console-local
local> signer.sendTransaction({ to: 'YOUR_ADDRESS', value: ethers.utils.parseEther('100') })
```
