// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

/**
 * @title IPlanetTokenMinter
 * @notice Interface for PlanetTokenMinter contract
 */
interface IPlanetTokenMinter {
  // ============ Sale Functions ============
  function purchase(uint256 amount) external payable;
  function purchaseWithLevel(uint256 amount, uint8 planetLevel) external payable;
  function purchaseWhitelist(uint256 amount, uint8 planetLevel) external payable;

  // ============ Airdrop Functions ============
  function airdrop(address recipient, uint256 amount, uint8 planetLevel) external;
  function airdropBatch(address[] calldata recipients, uint256[] calldata amounts, uint8 planetLevel) external;
  function airdropBatchWithLevels(
    address[] calldata recipients,
    uint256[] calldata amounts,
    uint8[] calldata levels
  ) external;

  // ============ Rewards Functions ============
  function reward(address recipient, uint256 amount, uint8 planetLevel, string calldata reason) external;

  // ============ Whitelist Functions ============
  function addToWhitelist(address account) external;
  function removeFromWhitelist(address account) external;
  function batchUpdateWhitelist(address[] calldata accounts, bool[] calldata allowed) external;
  function setWhitelistEnabled(bool enabled) external;
  function isWhitelisted(address account) external view returns (bool);

  // ============ Configuration Functions ============
  function setMintPrice(uint256 newPrice) external;
  function setLevelPrice(uint8 level, uint256 price) external;
  function setTreasury(address newTreasury) external;
  function setMaxSupply(uint256 newMaxSupply) external;
  function setMaxTokensPerAddress(uint256 newMax) external;

  // ============ Pause Functions ============
  function pause() external;
  function unpause() external;

  // ============ View Functions ============
  function getRemainingSupply() external view returns (uint256);
  function getLevelPrice(uint8 level) external view returns (uint256);
  function calculateCost(uint256 amount, uint8 planetLevel) external view returns (uint256);

  // ============ Public State Variables ============
  function planetToken() external view returns (address);
  function mintPrice() external view returns (uint256);
  function maxSupply() external view returns (uint256);
  function totalMinted() external view returns (uint256);
  function treasury() external view returns (address);
  function maxTokensPerAddress() external view returns (uint256);
  function whitelistEnabled() external view returns (bool);
  function addressMinted(address) external view returns (uint256);
}
