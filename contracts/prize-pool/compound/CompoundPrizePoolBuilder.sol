pragma solidity ^0.6.4;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

import "../../token/ControlledTokenProxyFactory.sol";
import "./CompoundPrizePoolProxyFactory.sol";

contract CompoundPrizePoolBuilder is Initializable {

  struct TokenDetails {
    string name;
    string symbol;
  }

  struct TokenDetailsParam {
    TokenDetails[] tokenDetails;
  }

  address public trustedForwarder;
  CompoundPrizePoolProxyFactory public compoundPrizePoolFactory;
  ControlledTokenProxyFactory public controlledTokenFactory;

  function initialize (
    address _trustedForwarder,
    ControlledTokenProxyFactory _controlledTokenFactory,
    CompoundPrizePoolProxyFactory _compoundPrizePoolFactory
  ) public initializer {
    require(address(_compoundPrizePoolFactory) != address(0), "CompoundPrizePoolBuilder/factory-zero");
    require(_trustedForwarder != address(0), "CompoundPrizePoolBuilder/forwarder-zero");
    require(address(_controlledTokenFactory) != address(0), "CompoundPrizePoolBuilder/controlled-token-factory-zero");
    compoundPrizePoolFactory = _compoundPrizePoolFactory;
    controlledTokenFactory = _controlledTokenFactory;
    trustedForwarder = _trustedForwarder;
  }

  function create(
    ComptrollerInterface comptroller,
    CTokenInterface cToken,
    TokenDetails[] calldata tokenDetails
  ) external returns (CompoundPrizePool compoundPrizePool, ControlledToken[] memory tokens) {
    compoundPrizePool = compoundPrizePoolFactory.create();

    tokens = new ControlledToken[](tokenDetails.length);
    for (uint256 i = 0; i < tokens.length; i++) {
      ControlledToken token = controlledTokenFactory.create();
      token.initialize(
        tokenDetails[i].name,
        tokenDetails[i].symbol,
        trustedForwarder,
        compoundPrizePool
      );
      tokens[i] = token;
    }

    compoundPrizePool.initialize(
      trustedForwarder,
      comptroller,
      tokens,
      cToken
    );
  }

}
