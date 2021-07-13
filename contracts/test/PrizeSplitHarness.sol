// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "../token/ControlledToken.sol";
import "../prize-strategy/PrizeSplit.sol";

/* solium-disable security/no-block-members */
contract PrizeSplitHarness is PrizeSplit {

  ControlledToken[] internal externalErc20s;

  constructor () public {
    __Ownable_init();
  }

  function initialize(ControlledToken[] calldata tokens) public {
    for (uint256 index = 0; index < tokens.length; index++) {
      externalErc20s.push(tokens[index]);
    }
  }

  function _awardPrizeSplitAmount(address target, uint256 amount, uint8 tokenIndex) override internal{
    require(tokenIndex == 0 || tokenIndex == 1, "PrizeSplitHarness/invalid-prizesplit-token-type");
    ControlledToken _token = externalErc20s[tokenIndex];
    _token.controllerMint(target, amount);
  }

  function distribute(uint256 prizeAmount) external returns (uint256) {
    prizeAmount = _distributePrizeSplits(prizeAmount);

    return prizeAmount;
  }

  function beforeTokenTransfer(address from, address to, uint256 amount) external {
    return;
  }
}