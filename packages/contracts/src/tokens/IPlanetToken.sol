// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC2981 } from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import { PlanetType } from "codegen/common.sol";

interface IPlanetToken is IERC721, IERC2981 {
  // External minting (called by other contracts/pages, NOT game)
  // Token holds level and planetType - biome and spaceType stored in game
  function mint(address to, uint8 planetLevel, PlanetType planetType) external returns (uint256);
  function mintBatch(
    address to,
    uint8[] calldata planetLevels,
    PlanetType[] calldata planetTypes
  ) external returns (uint256[] memory);
  function setMinter(address minter, bool allowed) external;
  function isMinter(address account) external view returns (bool);

  // Metadata functions - tokens hold level and planetType from mint
  function getTokenLevel(uint256 tokenId) external view returns (uint8);
  function getTokenPlanetType(uint256 tokenId) external view returns (PlanetType);
  function getTokenMetadata(uint256 tokenId) external view returns (uint8 level, PlanetType planetType);
  function tokenURI(uint256 tokenId) external view returns (string memory);
}
