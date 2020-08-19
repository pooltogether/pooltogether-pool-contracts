# PoolTogether Prize Savings Protocol

[![Coverage Status](https://coveralls.io/repos/github/pooltogether/pooltogether-pool-contracts/badge.svg?branch=version-3)](https://coveralls.io/github/pooltogether/pooltogether-pool-contracts?branch=version-3)

[![built-with openzeppelin](https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF)](https://docs.openzeppelin.com/)

The [PoolTogether](https://www.pooltogether.com/) Prize Savings Protocol Ethereum smart contracts.

See the [API documentation](https://docs.pooltogether.com/)

# Usage

If you need an ABI or to depend on the contracts, you can use NPM:

```bash
$ yarn add @pooltogether/pooltogether-contracts@alpha
```

Notice the `alpha` tag: this is important!  Otherwise you'll get the old code.

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
$ yarn deploy local
```

Interact with the contracts on the command line using [oz-console](https://github.com/pooltogether/oz-console):

```bash
$ yarn console-local
local> contracts.CompoundPrizePoolBuilder.address
```

To give test eth to an account, use the console:

```bash
$ yarn console-local
local> signer.sendTransaction({ to: 'YOUR_ADDRESS', value: ethers.utils.parseEther('100') })
```
