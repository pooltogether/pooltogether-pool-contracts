# LotteryManager Contracts

# Local Usage

Clone the repo and then install deps:

```
$ yarn
```

Copy over .envrc and allow direnv:

```
$ cp .envrc.example .envrc
$ direnv allow
```

Start `ganache-cli`:

```
$ yarn start
```

If you changed the mnemonic, you should update the ADMIN_ADDRESS variable in `.envrc` with another address (I use the second address listed when `ganache-cli` starts).

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

To see what data is bootstrapped, have a look at the migrations.


# Deploying to Ropsten

```
zos push --network ropsten --from <admin address>
yarn migrate-ropsten
```

# Notes

Current interest rate can be pulled from the MoneyMarket using:

MoneyMarket.markets(<asset>) and you should get back a tuple that contains, amoung other things, a supplyRateMantissa. This is the current per-block interest rate (scaled up by 1e18).

MoneyMarket on Rinkeby: 0x61bbd7bd5ee2a202d7e62519750170a52a8dfd45
