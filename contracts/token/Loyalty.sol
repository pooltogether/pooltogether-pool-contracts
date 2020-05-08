pragma solidity ^0.6.4;

import "@pooltogether/fixed-point/contracts/FixedPoint.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./ControlledToken.sol";

// solium-disable security/no-block-members
contract Loyalty is ControlledToken {
  using SafeMath for uint256;

  // mint loyalty tokens.  X amount of tokens will be minted.
  // underlying value of tokens increases over time.  Updated every time.

  uint256 public constant ETHER_MANTISSA = 1 ether;

  uint256 exchangeRateMantissa;
  uint256 loyaltyRatePerSecondMantissa;
  uint256 lastExchangeRateUpdateTimestamp;

  function initialize (
    string memory _name,
    string memory _symbol,
    TokenControllerInterface _controller,
    address _trustedForwarder,
    uint256 _loyaltyRatePerSecondMantissa
  ) public virtual initializer {
    super.initialize(_name, _symbol, _controller, _trustedForwarder);
    loyaltyRatePerSecondMantissa = _loyaltyRatePerSecondMantissa;
  }

  function updateExchangeRate() public {
    /*
      A = P(1 + rt)

      A	=	final amount
      P	=	initial principal balance
      r	=	annual interest rate
      t	=	time (in years)
    */
    uint256 secsMantissa = block.timestamp.sub(lastExchangeRateUpdateTimestamp).mul(1 ether);
    exchangeRateMantissa = FixedPoint.multiplyUintByMantissa(
      exchangeRateMantissa,
      ETHER_MANTISSA.add(FixedPoint.multiplyUintByMantissa(secsMantissa, loyaltyRatePerSecondMantissa))
    );
  }

  function supply(
    address account,
    uint256 amount
  ) external onlyController {
    updateExchangeRate();
    uint256 tokens = FixedPoint.divideUintByMantissa(amount, exchangeRateMantissa);
    _mint(account, tokens);
  }

  function balanceOfUnderlying(address user) external returns (uint256) {
    updateExchangeRate();
    return FixedPoint.multiplyUintByMantissa(balanceOf(user), exchangeRateMantissa);
  }

  function redeem(
    address from,
    uint256 amount
  ) external onlyController {
    updateExchangeRate();
    uint256 tokens = FixedPoint.divideUintByMantissa(amount, exchangeRateMantissa);
    _burn(from, tokens);
  }
}
