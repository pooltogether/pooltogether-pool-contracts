# PoolTogether Prize Savings Protocol

The [PoolTogether](https://www.pooltogether.com/) Prize Savings Protocol Ethereum smart contracts.

See the [API documentation](https://docs.pooltogether.com/)

# Setup

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
$ yarn migrate-local
```

Deploy a mock cToken contract:

```bash
$ yarn deploy-ctoken-local
```

Interact with the contracts on the command line using [oz-console](https://github.com/pooltogether/oz-console):

```bash
$ yarn console-local
local> contracts.SingleRandomWinnerPrizePoolBuilder.address
```

To give test eth to an account, use the console:

```bash
$ yarn console-local
local> signer.sendTransaction({ to: 'YOUR_ADDRESS', value: ethers.utils.parseEther('100') })
```
