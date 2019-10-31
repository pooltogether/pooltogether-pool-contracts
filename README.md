# PoolTogether Contracts

[![CircleCI](https://circleci.com/gh/pooltogether/pooltogether-contracts/tree/v2.x.svg?style=svg)](https://circleci.com/gh/pooltogether/pooltogether-contracts/tree/v2.x)

[Code Coverage](https://v2.coverage.pooltogether.us/)

The PoolTogether contracts allow users to deposit into a pool of tokens.  The pool is then supplied to the [Compound CErc20](https://compound.finance/developers).  After the bonding period is over, the supply plus interest is withdrawn.  The winner of a pool receives the interest earned.

# Setup

Clone the repo and then install deps:

```
$ yarn
```

Copy over .envrc and allow direnv:

```
$ cp .envrc.example .envrc
$ direnv allow
```

# Deploying Locally

If you changed the mnemonic, you should update the ADMIN_ADDRESS variable in `.envrc` with another address (I use the second address listed when `ganache-cli` starts).

Start `ganache-cli`:

```
$ yarn start
```

Now start a new OpenZeppelin SDK session:

```
$ yarn session
```

Push out the local contracts:

```
$ yarn push
```

Migrate the contracts and bootstrap the data:

```
$ yarn migrate
```

# Deploying to Rinkeby

```
yarn session-rinkeby
yarn push
yarn migrate-rinkeby
```
