# Mainnet Forking Guide

Maybe clear out old fork:
```sh
$ yarn rm -rf deployments/fork_1
```

Start the fork:

```sh
$ yarn start-fork
```

Copy over deployments:

```sh
$ cp -rf deployments/mainnet deployments/fork_1
```

Remove the changed deployments:

```sh
$ rm deployments/fork_1/CompoundPrizePoolBuilder.json deployments/fork_1/PoolWithMultipleWinnersBuilder.json deployments/fork_1/StakePrizePoolBuilder.json deployments/fork_1/VaultPrizePoolBuilder.json
```

Deploy Contracts:

```sh
$ yarn deploy fork
```

Fund gnosis safe:

```sh
$ yarn run-fork ./scripts/forks/distributeEtherFromBinance.js
```


