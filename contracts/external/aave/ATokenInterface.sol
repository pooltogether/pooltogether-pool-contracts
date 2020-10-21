pragma solidity >=0.6.0 <0.7.0;

interface ATokenInterface {
    function underlyingAssetAddress() external view returns (address);
    function redeem(uint256 _amount) external;
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function isTransferAllowed(address user, uint256 amount) external returns (bool);
    function redirectInterestStream(address _to) external;
    function redirectInterestStreamOf(address _from, address _to) external;
    function allowInterestRedirectionTo(address _to) external;

    function balanceOf(address _user) external view returns (uint256);
    function principalBalanceOf(address _user) external view returns (uint256);
    function getInterestRedirectionAddress(address _user) external view returns (address);
}
