// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { IERC2981 } from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import { MaterialType } from "codegen/common.sol";

/**
 * @title IMaterialToken
 * @dev Interface for MaterialToken ERC1155 contract
 */
interface IMaterialToken is IERC1155, IERC2981 {
  /**
   * @notice Mint material tokens
   * @param to Address to mint tokens to
   * @param materialType Material type to mint
   * @param amount Amount of material to mint
   * @param data Additional data
   */
  function mint(address to, MaterialType materialType, uint256 amount, bytes memory data) external;

  /**
   * @notice Mint multiple material types in batch
   * @param to Address to mint tokens to
   * @param materialTypes Array of material types
   * @param amounts Array of amounts
   * @param data Additional data
   */
  function mintBatch(
    address to,
    MaterialType[] memory materialTypes,
    uint256[] memory amounts,
    bytes memory data
  ) external;

  /**
   * @notice Burn material tokens
   * @param from Address to burn tokens from
   * @param materialType Material type to burn
   * @param amount Amount of material to burn
   */
  function burn(address from, MaterialType materialType, uint256 amount) external;

  /**
   * @notice Burn multiple material types in batch
   * @param from Address to burn tokens from
   * @param materialTypes Array of material types
   * @param amounts Array of amounts
   */
  function burnBatch(address from, MaterialType[] memory materialTypes, uint256[] memory amounts) external;

  /**
   * @notice Get token ID for a material type
   * @param materialType Material type
   * @return tokenId Token ID
   */
  function getTokenId(MaterialType materialType) external pure returns (uint256);

  /**
   * @notice Get material type for a token ID
   * @param tokenId Token ID
   * @return materialType Material type
   */
  function getMaterialType(uint256 tokenId) external view returns (MaterialType);

  /**
   * @notice Get material name for a material type
   * @param materialType Material type
   * @return name Material name
   */
  function getMaterialName(MaterialType materialType) external view returns (string memory);
  /**
   * @notice Get if a minter is a system minter
   * @param minter Address to check
   * @return bool True if the address is a system minter, false otherwise
   */
  function getSystemMinter(address minter) external view returns (bool);

  /**
   * @notice Add a system minter
   * @param minter Address to add as system minter
   */
  function addSystemMinter(address minter) external;
}
