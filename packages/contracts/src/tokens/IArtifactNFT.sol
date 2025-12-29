// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title IArtifactNFT
 * @dev Interface for Artifact NFT contract implementing ERC721 with artifact-specific functionality
 * @notice Extends ERC721 to support artifact minting, depositing, and Dark Forest PUNK world integration
 */
interface IArtifactNFT is IERC721 {
  /**
   * @notice Mint a new artifact NFT
   * @param to Address to mint the artifact to
   * @param tokenId Unique token ID for the artifact
   * @param artifactIndex Index of the artifact type (e.g., Photoid Cannon, Wormhole, etc.)
   * @param artifactRarity Rarity level of the artifact (0=Common, 1=Rare, 2=Epic, 3=Legendary, 4=Mythic)
   * @param biome Biome where the artifact was found
   */
  function mint(address to, uint256 tokenId, uint8 artifactIndex, uint8 artifactRarity, uint8 biome) external;

  /**
   * @notice Deposit an artifact from a player to the Dark Forest world contract
   * @param to Address of the Dark Forest world contract to deposit to
   * @param tokenId Token ID of the artifact to deposit
   * @param from Address of the current owner (player) transferring the artifact
   * @dev This function allows the Dark Forest PUNK world contract to receive artifacts without implementing IERC721Receiver
   */
  function depositFrom(address to, uint256 tokenId, address from) external;

  /**
   * @notice Set the Dark Forest world contract address for a specific round
   * @param round Round number to associate with the world contract
   * @param world Address of the Dark Forest PUNK world contract
   * @dev Allows the contract to track which world contract is authorized to deposit artifacts
   */
  function setDF(uint8 round, address world) external;

  /**
   * @notice Get artifact data for a specific token ID
   * @param tokenId Token ID to query
   * @return index Artifact type index
   * @return rarity Rarity level of the artifact
   * @return biome Biome where the artifact was found
   */
  function getArtifact(uint256 tokenId) external view returns (uint8 index, uint8 rarity, uint8 biome);
}
