# PoolTogether v3

## Architecture

PrizePool: Base primitive.  Autonomous prize-linked savings account
GovernanceFee: Configures and creates Pools.

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

Timelock
  - Track missing interest per user.
  - When user attempts to transfer or withdraw tokens, add a check to see if they've covered their interest.
  - if the user has not covered their interest, convert the tickets to timelocked sponsorship.

## Participation

How do we measure how much each user has contributed?
We could measure how long they've had assets in the system.

Participation is minted when they need it?