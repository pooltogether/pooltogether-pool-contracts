<p align="center">
  <a href="https://github.com/pooltogether/pooltogether--brand-assets">
    <img src="https://github.com/pooltogether/pooltogether--brand-assets/blob/977e03604c49c63314450b5d432fe57d34747c66/logo/pooltogether-logo--purple-gradient.png?raw=true" alt="PoolTogether Brand" style="max-width:100%;" width="200">
  </a>
</p>

<br />

## PoolTogether Prize Savings Protocol

[![Coverage Status](https://coveralls.io/repos/github/pooltogether/pooltogether-pool-contracts/badge.svg?branch=master)](https://coveralls.io/github/pooltogether/pooltogether-pool-contracts?branch=master)

[![built-with openzeppelin](https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF)](https://docs.openzeppelin.com/)

The [PoolTogether](https://www.pooltogether.com/) Prize Savings Protocol Ethereum smart contracts.

For an overview of the concepts and API please see the [documentation](https://docs.pooltogether.com/)

#### Setup

This project is available as an NPM package:

```bash
$ yarn add @pooltogether/pooltogether-contracts
```

#### Usage

###### Artifacts

There are deployment artifacts available in the `deployments/` directory.  This includes:

- Builders
- Proxy Factories
- Comptroller
- ProxyAdmin

Prize Pools and Prize Strategies are not included, as they are created using the Builders.

For example, to pull in the PoolWithMultipleWinnersBuilder artifact:

```javascript
const PoolWithMultipleWinnersBuilder = require('@pooltogether/pooltogether-contracts/deployments/rinkeby/PoolWithMultipleWinnersBuilder.json')
const {
  abi, 
  address, 
  receipt
 } = PoolWithMultipleWinnersBuilder
```

###### ABIs

Application Binary Interfaces for all PoolTogether contracts and related contracts are available in the `abis/` directory.

For example, to pull in the PrizePool ABI:

```javascript
const PrizePool = require('@pooltogether/pooltogether-contracts/abis/PrizePool.json')
```

#### Development

First clone this repository and enter the directory.

Switch to the `version-3` branch:

```
$ git checkout version-3
```

Install dependencies:

```
$ yarn
```

We make use of [Hardhat](https://hardhat.dev) and [hardhat-deploy](https://github.com/wighawag/hardhat-deploy)

#### Testing

To run unit & integration tests:

```sh
$ yarn test
```

To run coverage:

```sh
$ yarn coverage
```

To run fuzz tests:

```sh
$ yarn echidna
```

#### Deployment

###### Deploy Locally

Start a local node and deploy the top-level contracts:

```bash
$ yarn start
```

NOTE: When you run this command it will reset the local blockchain.

###### Connect Locally

Start up a [Hardhat Console](https://hardhat.dev/guides/hardhat-console.html):

```bash
$ hardhat console --network localhost
```

Now you can load up the deployed contracts using [hardhat-deploy](https://github.com/wighawag/hardhat-deploy):

```javascript
> await deployments.all()
```

If you want to send transactions, you can get the signers like so:

```javascript
> let signers = await ethers.getSigners()
```

Let's mint some Dai for ourselves:

```javascript
> let dai = await ethers.getContractAt('ERC20Mintable', (await deployments.get('Dai')).address, signers[0])
> await dai.mint(signers[0]._address, ethers.utils.parseEther('10000'))
> ethers.utils.formatEther(await dai.balanceOf(signers[0]._address))
```

###### Deploy to Live Networks

Copy over .envrc.example to .envrc

```
$ cp .envrc.example .envrc
```

Make sure to update the enviroment variables with suitable values.

Now enable the env vars using [direnv](https://direnv.net/docs/installation.html)

```
$ direnv allow
```

Now deploy to a network like so:

```
$ yarn deploy rinkeby
```

It will update the `deployments/` dir.
