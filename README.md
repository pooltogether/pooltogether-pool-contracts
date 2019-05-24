# PoolTogether Contracts

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

Now start a new zos session:

```
$ yarn session
```

Push out the local contracts:

```
$ zos push
```

Migrate the contracts and bootstrap the data:

```
$ yarn migrate
```

# Deploying to Rinkeby

```
yarn session-rinkeby
zos push
yarn migrate-rinkeby
```

## Notes

Current interest rate can be pulled from the CErc20 using:

CErc20.markets(<asset>) and you should get back a tuple that contains, amoung other things, a supplyRateMantissa. This is the current per-block interest rate (scaled up by 1e18).

CErc20 on Rinkeby: 0x61bbd7bd5ee2a202d7e62519750170a52a8dfd45
