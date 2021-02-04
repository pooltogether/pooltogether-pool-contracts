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

Deploy PoolTogether v3.2 Contracts:

```sh
$ yarn deploy fork
```

Fund gnosis safe:

```sh
$ yarn run-fork ./scripts/forks/distributeEtherFromBinance.js
```

Deploy Governance Contracts
```sh
$cd governance; yarn deploy fork;

```
Copy generated addresses into pooltogether-pool-contracts (this repo):
- Pool
- Timelock
- GovernanceAlpha
- TreasuryVesterFor*
- TreasuryVesterForTreasury

into namedAccounts in config


Update Pool contract address in merkle-distributor repo
```sh
cd merkle-distributor
```

Deploy MerkleDistributor Contracts
```sh
yarn deploy fork
```

Update MerkleDistrbutor address in this repo.

Distribute tokens to Vesting contracts, treasury and MerkleDistributor
```sh
$ yarn run-fork ./scripts/forks/governance/disbursePoolTokens.js
```

Create TokenFaucets and transfer pool to Faucets:
```sh
$ yarn run-fork ./scripts/forks/governance/createTokenFaucets.js
```

Claim from merkle distributor for whale account:
```sh
$ yarn run-fork ./scripts/forks/goverance/claimFromMerkleDistributor.js
```

Delegate Voting of Pool
```sh
$ yarn run-fork ./scripts/forks/goverance/delegate.js
```

Create Proposals
```sh
$ yarn run-fork ./scripts/forks/goverance/createProposal.js
```

