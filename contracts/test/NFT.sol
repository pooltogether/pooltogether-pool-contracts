pragma solidity 0.6.12;
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

contract NFT is ERC721Upgradeable {
  function initialize (
    string memory name_, string memory symbol_
  ) external initializer {
    __ERC721_init(name_, symbol_);
    _safeMint(msg.sender, 0);
  }

  function simulateSafeTransferFrom(address from, address to, uint256 tokenId) public {
    ERC721Upgradeable.safeTransferFrom(from, to, tokenId);
  }
}