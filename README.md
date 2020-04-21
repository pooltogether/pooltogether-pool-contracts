# PoolTogether V2 Contracts

[![CircleCI](https://circleci.com/gh/pooltogether/pooltogether-contracts.svg?style=svg)](https://circleci.com/gh/pooltogether/pooltogether-contracts)
[![built-with openzeppelin](https://img.shields.io/badge/built%20with-OpenZeppelin-3677FF)](https://docs.openzeppelin.com/)

[Code Coverage](https://v2.coverage.pooltogether.us/)

PoolTogether is a prize-linked savings account built on Ethereum. This project contains the Ethereum smart contracts that power the protocol.  The protocol is described in detail in the article [Inside PoolTogether v2.0](https://medium.com/pooltogether/inside-pooltogether-v2-0-e7d0e1b90a08).

**If you want to run PoolTogether locally in an isolated test environment check out the [PoolTogether Mock](https://github.com/pooltogether/pooltogether-contracts-mock) project**

# Ethereum Networks

PoolTogether V2 is an upgradeable system.  Each deployed contract is actually a "Proxy" that points to an "Implementation" contract.  When making calls on any contract make sure to use the Proxy address, not the implementation.

## Mainnet

| Contract                | Address | Version |
| -------                 | -------- | ---------- |
| Pool Sai                | [0xb7896fce748396EcFC240F5a0d3Cc92ca42D7d84](https://etherscan.io/address/0xb7896fce748396EcFC240F5a0d3Cc92ca42D7d84) | MCDAwarePool v0.2.12 |
| Pool Sai Token (plSai)  | [0xfE6892654CBB05eB73d28DCc1Ff938f59666Fe9f](https://etherscan.io/address/0xfE6892654CBB05eB73d28DCc1Ff938f59666Fe9f) | RecipientWhitelistPoolToken v0.2.12 |
| Pool Dai                | [0x29fe7D60DdF151E5b52e5FAB4f1325da6b2bD958](https://etherscan.io/address/0x29fe7D60DdF151E5b52e5FAB4f1325da6b2bD958) | MCDAwarePool v0.2.12 |
| Pool Dai Token (plDai)  | [0x49d716DFe60b37379010A75329ae09428f17118d](https://etherscan.io/address/0x49d716DFe60b37379010A75329ae09428f17118d) | RecipientWhitelistPoolToken v0.2.12 |
| Pool Usdc               | [0x0034Ea9808E620A0EF79261c51AF20614B742B24](https://etherscan.io/address/0x0034Ea9808E620A0EF79261c51AF20614B742B24) | MCDAwarePool v0.2.12 |
| Pool Usdc Token (plUsdc)| [0xBD87447F48ad729C5c4b8bcb503e1395F62e8B98](https://etherscan.io/address/0xBD87447F48ad729C5c4b8bcb503e1395F62e8B98) | RecipientWhitelistPoolTokenDecimals v0.2.12 |

## Kovan

| Contract      | Address (proxy)   | Address (implementation) |
| -------       | --------          | ----------- |
| PoolSai       | [0x9B80beA68835e8E39b9CeaeF83B7b49e9D41661C](https://kovan.etherscan.io/address/0x9B80beA68835e8E39b9CeaeF83B7b49e9D41661C) | [0x11149E1B3C8e334a889FC697230b377F47Fa32Ca](https://kovan.etherscan.io/address/0x11149E1B3C8e334a889FC697230b377F47Fa32Ca) |
| PoolSaiToken  | [0xC9689253a545D0C4dc733620281bBdCbb9FA4A4D](https://kovan.etherscan.io/address/0xC9689253a545D0C4dc733620281bBdCbb9FA4A4D) | [0x55d462dB374D0D96EDB3aa603a4D8B8617bBdAA1](https://kovan.etherscan.io/address/0x55d462dB374D0D96EDB3aa603a4D8B8617bBdAA1) |
| PoolDai       | [0xC3a62C8Af55c59642071bC171Ebd05Eb2479B663](https://kovan.etherscan.io/address/0xC3a62C8Af55c59642071bC171Ebd05Eb2479B663) | [0x662Aa47D4b9B4CFC4DB8f6dac0381fFFd2faC342](https://kovan.etherscan.io/address/0x662Aa47D4b9B4CFC4DB8f6dac0381fFFd2faC342) |
| PoolDaiToken  | [0x1237a9f1664895bc30cfe9eCD1e3f6C2A83700AD](https://kovan.etherscan.io/address/0x1237a9f1664895bc30cfe9eCD1e3f6C2A83700AD) | [0xAe2065e2298C6940d5bd59cD1c7bB6264c772c6A](https://kovan.etherscan.io/address/0xAe2065e2298C6940d5bd59cD1c7bB6264c772c6A) |
| PoolUsdc      | [0xa0B2A98d0B769886ec06562ee9bB3572Fa4f3aAb](https://kovan.etherscan.io/address/0xa0B2A98d0B769886ec06562ee9bB3572Fa4f3aAb) | [0xa05a7065a257DF3A0531298dc15CBCb0Ce5a3Ff5](https://kovan.etherscan.io/address/0xa05a7065a257DF3A0531298dc15CBCb0Ce5a3Ff5) |
| PoolUsdcToken | [0xf08d73ABC5E46811649380cCb02bF1aDCc37E59c](https://kovan.etherscan.io/address/0xf08d73ABC5E46811649380cCb02bF1aDCc37E59c) | [0x6C5492664df0ED36f29D654Fd62e9C3A3F6279A3](https://kovan.etherscan.io/address/0x6C5492664df0ED36f29D654Fd62e9C3A3F6279A3) |

# Setup

Clone the repo and then install dependencies:

```
$ yarn
```

# Testing

To run the entire test suite:

```
$ yarn test
```

# Coverage

To run tests with coverage:

```
$ yarn coverage
```

# How it Works

A prize-linked savings account is one in which interest payments are distributed as prizes.  PoolTogether uses [Compound](https://compound.finance) to generate interest on pooled deposits and distributes the interest in prize draws.

## User Flow

1. An administrator opens a new draw by committing the hash of a secret and salt.
2. A user deposits tokens into the Pool.  The Pool transfers the tokens to the Compound CToken contract and adds the deposit to the currently open draw.
3. Time passes.  Interest accrues.
4. An administrator executes the "reward" function, which:
  - If there is a committed draw it is "rewarded": the admin reveals the previously committed secret and uses it to select a winner for the currently accrued interest on the pool deposits.  The interest is added to the open draw to increase the user's eligibility.
  - The open draw is "committed", meaning it will no longer receive deposits.
  - A new draw is opened to receive deposits.  The admin commits a hash of a secret and salt.
5. A user withdraws.  The Pool will withdraw from the Compound CToken all of the user's deposits and winnings.  Any amounts across open, committed, or rewarded draws will be withdrawn.

As you can see, prizes are awarded in rolling draws.  In this way, we can ensure users will contribute fairly to a prize.  The open period allows users to queue up their deposits for the committed period, then once the committed period is over the interest accrued is awarded to one of the participants.

You can visualize the rolling draws like so:

| Step  | Draw 1    | Draw 2    | Draw 3    | Draw 4    |  Draw ... |
| ----- | ------    | ------    | ------    | ------    | --------- |
| 1     | Open      |           |           |           |           |
| 2     | Committed | Open      |           |           |           |
| 3     | Rewarded  | Committed | Open      |           |           |
| 4     |           | Rewarded  | Committed | Open      |           |
| 5     |           |           | Rewarded  | Committed |           |
| ...   |           |           |           | Rewarded  |           |

## Winner Selection

When a Pool administrator opens a new draw, they commit a hash of a secret and salt.  When the Pool administrator rewards a draw, they reveal the secret and salt.  The secret is then hashed and used to randomly select a winner.

Decentralizing this portion of the protocol is very high on our to-do list.

# Testing Upgrades

The project includes a CLI tool to make working with forks much easier.  To see what commands the tool offers, enter:

```sh
$ yarn fork -h
```

The fork command will allow you to spin up a fork of mainnet and run transactions using unlocked accounts.  The first 10 largest accounts from the subgraph are automatically unlocked.

## Upgrading All Proxies

To upgrade all proxies in the fork by doing a simple implementation address change (i.e. using `upgrade` vs `upgradeAndCall`) you can use the `yarn fork upgrade` command.  Just make sure to `yarn fork push` the new contracts first.

For example:

```sh
# starts the fork
$ yarn fork start
```

```sh
# Ensures the necessary accounts have Eth and tokens
$ yarn fork pay
```

```sh
# Pushes the latest contract implementations to the fork
$ yarn fork push
```

```sh
# Upgrades the deployed proxies to their latest implementations
$ yarn fork upgrade
```

## Fork Actions

There are a few pre-baked actions that can be performed to test the fork.

```sh
# For the top ten users, withdraw and then deposit back into the pool.
$ yarn fork withdraw-deposit
```

```sh
# Rewards the pool
$ yarn fork reward
```
