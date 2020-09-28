# PoolTogether V3 Alpha Release Process

Once the smart contracts have been updated, follow the steps below.

## 1. Deploy Top-level Contracts

Run the command:

```bash
$ yarn deploy rinkeby
```

## 2. Verify the contracts on Etherscan

```bash
$ yarn etherscan-verify rinkeby
```

## 3. Publish pooltogether-contracts npm package

First increment the alpha version

```bash
$ yarn publish --tag alpha
```

## 4. Update Builder UI

The Builder UI will need to point to the latest alpha deployed builder contracts.

Update the package dependency and QA

## 5. Create New Prize Pools

Create new prize pools using the builders.

## 6. Update Reference Pool UI

The reference pool UI needs to be QA'd.

## 7. Update the Subgraph

Ensure that the subgraph is updated.

## 8. Update the Pool App

The Pool app should point to the new prize pools created in step 6

This will entail:

- QA'ing the pool app
- Updating [current-pool-data](https://github.com/pooltogether/current-pool-data)
  1. Update the pool addresses
  2. publish the package

## 9. Update the Gitbook Networks

The update script is in [pooltogether-pool-contracts](https://github.com/pooltogether/pooltogether-pool-contracts)

First update the dependency `@pooltogether/current-pool-data` then run:

```bash
$ yarn update-gitbook-networks
```
