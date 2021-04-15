# Changelog

## 3.3.0

### Added

- Yield Source Prize Pool that utilizes an external Yield Source
- Ability for the owner of a prize pool to delegate COMP-like tokens that are held
- "Before Award Listener" for the PeriodicPrizeStrategy as a pre-award callback
- Ability for the owner of a PeriodicPrizeStrategy to change the prize period
- Sablier integration to stream prizes to prize pools

## 3.3.8

- Removed SablierManager
- Removed yVaultPrizePool
- Removed SingleRandomWinner
- CompoundPrizePool now uses safeApprove for USDT compatibility
- YieldSourcePrizePool now users SafeERC20
- YieldSourcePrizePool now does sanity checks on the yield source
- PeriodicPrizeStrategy uses SafeERC20 safeApprove
