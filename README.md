# PoolTogether v3

## Architecture

PrizePool: Base primitive.  Autonomous prize-linked savings account
PrizePoolFactory: Configures and creates Pools.

When a Pool is created it is configured with:
- Prize Distribution Strategy
- Compound cToken

A Prize Distribution Strategy is a contract that has permission to distribute a Pool's prize.

SingleRandomWinnerStrategy: Awards the prize to a single randomly selected winner

When a SingleRandomWinnerStrategy is created it is configured with:
- RNG Strategy

Available RNG Services:

- Blockhash Strategy (weak security, free)
- ChainLink VRF Strategy (? security, ?)
- VeeDo Strategy (high security, expensive)





