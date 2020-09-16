pragma solidity 0.6.12;

interface OpenZeppelinProxyFactoryInterface {
  function deploy(uint256 _salt, address _logic, address _admin, bytes calldata _data) external returns (address);
  function getDeploymentAddress(uint256 _salt, address _sender) external view returns (address);
}
