# PoolTogether Prize Savings Protocol

[![Coverage Status](https://coveralls.io/repos/github/pooltogether/pooltogether-pool-contracts/badge.svg?branch=version-3)](https://coveralls.io/github/pooltogether/pooltogether-pool-contracts?branch=version-3)

[![built-with openzeppelin](https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF)](https://docs.openzeppelin.com/)

The [PoolTogether](https://www.pooltogether.com/) Prize Savings Protocol Ethereum smart contracts.

For an overview of the concepts and API please see the [documentation](https://docs.pooltogether.com/)

# Setup

This project is available as an NPM package:

```bash
$ yarn add @pooltogether/pooltogether-contracts@alpha
```

Notice the `alpha` tag: this is important!  Otherwise you'll get the V2 code.

# Usage

## Artifacts

There are deployment artifacts available in the `deployments/` directory.  This includes:

- Builders
- Proxy Factories
- Comptroller
- ProxyAdmin

Prize Pools and Prize Strategies are not included, as they are created using the Builders.

For example, to pull in the CompoundPrizePoolBuilder artifact:

```javascript
const CompoundPrizePoolBuilder = require('@pooltogether/pooltogether-contracts/deployments/rinkeby/CompoundPrizePoolBuilder.json')
const {
  abi, 
  address, 
  receipt
 } = CompoundPrizePoolBuilder
```

## ABIs

Application Binary Interfaces for all PoolTogether contracts and related contracts are available in the `abis/` directory.

For example, to pull in the PrizePool ABI:

```javascript
const PrizePool = require('@pooltogether/pooltogether-contracts/abis/PrizePool.json')
```

# Development

First clone this repository and enter the directory.

Install dependencies:

```
$ yarn
```

## Deploy Locally

First start the local node:

```bash
$ yarn start
```

## Deploy to Live Networks

Copy over .envrc.example to .envrc

```
$ cp .envrc.example .envrc
```

Make sure to update the enviroment variables with suitable values.

Now enable the env vars using [direnv](https://direnv.net/docs/installation.html)

```
$ direnv allow
```

