// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { IPlanetToken } from "./IPlanetToken.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { Errors } from "interfaces/errors.sol";
import { PlanetType } from "codegen/common.sol";

/**
 * @title PlanetTokenMinter
 * @notice External minting contract for PUNK PlanetToken
 * @dev Supports sale, airdrop, rewards, and whitelist functionality
 *      This contract must be granted minter permissions on PlanetToken
 */
contract PlanetTokenMinter is Ownable, ReentrancyGuard, Pausable {
  IPlanetToken public planetToken;

  // Sale configuration
  uint256 public mintPrice; // Price per token in wei
  uint256 public maxSupply; // Maximum tokens that can be minted through this contract
  uint256 public totalMinted; // Total tokens minted through this contract
  address public treasury; // Address to receive sale proceeds

  // Purchase limits
  uint256 public maxTokensPerAddress; // Maximum tokens per address
  mapping(address => uint256) public addressMinted; // Track minted tokens per address

  // Whitelist for pre-sale
  mapping(address => bool) public whitelist;
  bool public whitelistEnabled;

  // Level pricing (optional: different prices for different levels)
  mapping(uint8 => uint256) public levelPrice; // Price per level (0 = use default mintPrice)

  // Default planet type for minting (can be overridden in function calls)
  PlanetType public defaultPlanetType = PlanetType.PLANET;

  // Events
  event TokensPurchased(address indexed buyer, uint256 amount, uint256 totalCost, uint8 planetLevel);
  event TokensAirdropped(address indexed recipient, uint256 amount, uint8 planetLevel);
  event TokensRewarded(address indexed recipient, uint256 amount, uint8 planetLevel, string reason);
  event WhitelistUpdated(address indexed account, bool allowed);
  event WhitelistToggled(bool enabled);
  event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
  event LevelPriceUpdated(uint8 level, uint256 price);
  event TreasuryUpdated(address oldTreasury, address newTreasury);
  event MaxSupplyUpdated(uint256 oldMax, uint256 newMax);
  event MaxTokensPerAddressUpdated(uint256 oldMax, uint256 newMax);

  modifier validLevel(uint8 level) {
    require(level >= 1 && level <= 9, "PlanetTokenMinter: invalid level (1-9)");
    _;
  }

  modifier validAmount(uint256 amount) {
    require(amount > 0, "PlanetTokenMinter: amount must be > 0");
    _;
  }

  /**
   * @notice Constructor
   * @param _planetToken Address of the PlanetToken contract
   * @param _mintPrice Default price per token in wei
   * @param _treasury Address to receive sale proceeds
   * @param _maxSupply Maximum tokens that can be minted through this contract
   * @param _maxTokensPerAddress Maximum tokens per address
   */
  constructor(
    address _planetToken,
    uint256 _mintPrice,
    address _treasury,
    uint256 _maxSupply,
    uint256 _maxTokensPerAddress
  ) Ownable(msg.sender) {
    if (_planetToken == address(0)) revert Errors.InvalidMinter(_planetToken);
    if (_treasury == address(0)) revert Errors.InvalidRecipient(_treasury);

    planetToken = IPlanetToken(_planetToken);
    mintPrice = _mintPrice;
    treasury = _treasury;
    maxSupply = _maxSupply;
    maxTokensPerAddress = _maxTokensPerAddress;
    whitelistEnabled = false;
  }

  // ============ Sale Functions ============

  /**
   * @notice Purchase tokens with default level (level 4) and default planet type
   * @param amount Amount of tokens to purchase (for ERC721, typically 1)
   */
  function purchase(uint256 amount) external payable nonReentrant whenNotPaused validAmount(amount) {
    _purchase(msg.sender, amount, 4, defaultPlanetType, mintPrice);
  }

  /**
   * @notice Purchase tokens with specific planet level and default planet type
   * @param amount Amount of tokens to purchase (for ERC721, typically 1)
   * @param planetLevel Planet level (1-9)
   */
  function purchaseWithLevel(
    uint256 amount,
    uint8 planetLevel
  ) external payable nonReentrant whenNotPaused validAmount(amount) validLevel(planetLevel) {
    uint256 price = levelPrice[planetLevel] > 0 ? levelPrice[planetLevel] : mintPrice;
    _purchase(msg.sender, amount, planetLevel, defaultPlanetType, price);
  }

  /**
   * @notice Purchase tokens with specific planet level and planet type
   * @param amount Amount of tokens to purchase (for ERC721, typically 1)
   * @param planetLevel Planet level (1-9)
   * @param planetType Planet type
   */
  function purchaseWithLevelAndType(
    uint256 amount,
    uint8 planetLevel,
    PlanetType planetType
  ) external payable nonReentrant whenNotPaused validAmount(amount) validLevel(planetLevel) {
    require(planetType != PlanetType.UNKNOWN, "PlanetTokenMinter: invalid planetType");
    uint256 price = levelPrice[planetLevel] > 0 ? levelPrice[planetLevel] : mintPrice;
    _purchase(msg.sender, amount, planetLevel, planetType, price);
  }

  /**
   * @notice Purchase tokens during whitelist phase
   * @param amount Amount of tokens to purchase (for ERC721, typically 1)
   * @param planetLevel Planet level (1-9)
   */
  function purchaseWhitelist(
    uint256 amount,
    uint8 planetLevel
  ) external payable nonReentrant whenNotPaused validAmount(amount) validLevel(planetLevel) {
    require(whitelistEnabled, "PlanetTokenMinter: whitelist not enabled");
    require(whitelist[msg.sender], "PlanetTokenMinter: not whitelisted");
    uint256 price = levelPrice[planetLevel] > 0 ? levelPrice[planetLevel] : mintPrice;
    _purchase(msg.sender, amount, planetLevel, defaultPlanetType, price);
  }

  /**
   * @notice Internal purchase function
   * @param buyer Address purchasing tokens
   * @param amount Amount of tokens (for ERC721, typically 1)
   * @param planetLevel Planet level
   * @param planetType Planet type
   * @param price Price per token
   */
  function _purchase(address buyer, uint256 amount, uint8 planetLevel, PlanetType planetType, uint256 price) internal {
    // Check supply limits and calculate cost
    uint256 totalCost;
    {
      require(totalMinted + amount <= maxSupply, "PlanetTokenMinter: exceeds max supply");
      require(addressMinted[buyer] + amount <= maxTokensPerAddress, "PlanetTokenMinter: exceeds per-address limit");
      totalCost = amount * price;
      require(msg.value >= totalCost, "PlanetTokenMinter: insufficient payment");
    }

    // Mint tokens (ERC721 - mint one at a time in a loop)
    {
      for (uint256 i = 0; i < amount; i++) {
        planetToken.mint(buyer, planetLevel, planetType);
      }
    }

    // Update tracking
    totalMinted += amount;
    addressMinted[buyer] += amount;

    // Handle payments
    {
      uint256 excess = msg.value > totalCost ? msg.value - totalCost : 0;
      if (excess > 0) {
        payable(buyer).transfer(excess);
      }
      if (totalCost > 0) {
        payable(treasury).transfer(totalCost);
      }
    }

    emit TokensPurchased(buyer, amount, totalCost, planetLevel);
  }

  // ============ Airdrop Functions ============

  /**
   * @notice Airdrop tokens to a single address (free)
   * @param recipient Address to receive tokens
   * @param amount Amount of tokens to airdrop (for ERC721, typically 1)
   * @param planetLevel Planet level (1-9)
   */
  function airdrop(
    address recipient,
    uint256 amount,
    uint8 planetLevel
  ) external onlyOwner nonReentrant validAmount(amount) validLevel(planetLevel) {
    require(recipient != address(0), "PlanetTokenMinter: invalid recipient");
    require(totalMinted + amount <= maxSupply, "PlanetTokenMinter: exceeds max supply");

    // Mint tokens (ERC721 - mint one at a time)
    for (uint256 i = 0; i < amount; i++) {
      planetToken.mint(recipient, planetLevel, defaultPlanetType);
    }
    totalMinted += amount;

    emit TokensAirdropped(recipient, amount, planetLevel);
  }

  /**
   * @notice Airdrop tokens to a single address with planet type
   * @param recipient Address to receive tokens
   * @param amount Amount of tokens to airdrop (for ERC721, typically 1)
   * @param planetLevel Planet level (1-9)
   * @param planetType Planet type
   */
  function airdropWithType(
    address recipient,
    uint256 amount,
    uint8 planetLevel,
    PlanetType planetType
  ) external onlyOwner nonReentrant validAmount(amount) validLevel(planetLevel) {
    require(recipient != address(0), "PlanetTokenMinter: invalid recipient");
    require(planetType != PlanetType.UNKNOWN, "PlanetTokenMinter: invalid planetType");
    require(totalMinted + amount <= maxSupply, "PlanetTokenMinter: exceeds max supply");

    // Mint tokens (ERC721 - mint one at a time)
    for (uint256 i = 0; i < amount; i++) {
      planetToken.mint(recipient, planetLevel, planetType);
    }
    totalMinted += amount;

    emit TokensAirdropped(recipient, amount, planetLevel);
  }

  /**
   * @notice Batch airdrop tokens to multiple addresses
   * @param recipients Array of recipient addresses
   * @param amounts Array of amounts (must match recipients length)
   * @param planetLevel Planet level (1-9) - same for all recipients
   */
  function airdropBatch(
    address[] calldata recipients,
    uint256[] calldata amounts,
    uint8 planetLevel
  ) external onlyOwner nonReentrant validLevel(planetLevel) {
    require(recipients.length == amounts.length, "PlanetTokenMinter: arrays length mismatch");

    uint256 totalAmount;
    {
      for (uint256 i = 0; i < amounts.length; i++) {
        totalAmount += amounts[i];
      }
      require(totalMinted + totalAmount <= maxSupply, "PlanetTokenMinter: exceeds max supply");
    }

    for (uint256 i = 0; i < recipients.length; i++) {
      require(recipients[i] != address(0), "PlanetTokenMinter: invalid recipient");
      require(amounts[i] > 0, "PlanetTokenMinter: amount must be > 0");
      // Mint tokens (ERC721 - mint one at a time)
      {
        uint256 amount = amounts[i];
        for (uint256 j = 0; j < amount; j++) {
          planetToken.mint(recipients[i], planetLevel, defaultPlanetType);
        }
      }
      emit TokensAirdropped(recipients[i], amounts[i], planetLevel);
    }

    totalMinted += totalAmount;
  }

  /**
   * @notice Batch airdrop with different levels per recipient
   * @param recipients Array of recipient addresses
   * @param amounts Array of amounts
   * @param levels Array of planet levels (must match recipients length)
   */
  function airdropBatchWithLevels(
    address[] calldata recipients,
    uint256[] calldata amounts,
    uint8[] calldata levels
  ) external onlyOwner nonReentrant {
    require(
      recipients.length == amounts.length && recipients.length == levels.length,
      "PlanetTokenMinter: arrays length mismatch"
    );

    uint256 totalAmount;
    {
      for (uint256 i = 0; i < amounts.length; i++) {
        require(levels[i] >= 1 && levels[i] <= 9, "PlanetTokenMinter: invalid level");
        totalAmount += amounts[i];
      }
      require(totalMinted + totalAmount <= maxSupply, "PlanetTokenMinter: exceeds max supply");
    }

    for (uint256 i = 0; i < recipients.length; i++) {
      require(recipients[i] != address(0), "PlanetTokenMinter: invalid recipient");
      require(amounts[i] > 0, "PlanetTokenMinter: amount must be > 0");
      // Mint tokens (ERC721 - mint one at a time)
      {
        uint256 amount = amounts[i];
        uint8 level = levels[i];
        for (uint256 j = 0; j < amount; j++) {
          planetToken.mint(recipients[i], level, defaultPlanetType);
        }
      }
      emit TokensAirdropped(recipients[i], amounts[i], levels[i]);
    }

    totalMinted += totalAmount;
  }

  // ============ Rewards Functions ============

  /**
   * @notice Mint tokens as rewards (free, with reason tracking)
   * @param recipient Address to receive reward tokens
   * @param amount Amount of tokens (for ERC721, typically 1)
   * @param planetLevel Planet level (1-9)
   * @param reason Reason for reward (for tracking/events)
   */
  function reward(
    address recipient,
    uint256 amount,
    uint8 planetLevel,
    string calldata reason
  ) external onlyOwner nonReentrant validAmount(amount) validLevel(planetLevel) {
    require(recipient != address(0), "PlanetTokenMinter: invalid recipient");
    require(totalMinted + amount <= maxSupply, "PlanetTokenMinter: exceeds max supply");

    // Mint tokens (ERC721 - mint one at a time)
    for (uint256 i = 0; i < amount; i++) {
      planetToken.mint(recipient, planetLevel, defaultPlanetType);
    }
    totalMinted += amount;

    emit TokensRewarded(recipient, amount, planetLevel, reason);
  }

  /**
   * @notice Set default planet type for minting
   * @param planetType Default planet type to use
   */
  function setDefaultPlanetType(PlanetType planetType) external onlyOwner {
    require(planetType != PlanetType.UNKNOWN, "PlanetTokenMinter: invalid planetType");
    defaultPlanetType = planetType;
  }

  // ============ Whitelist Functions ============

  /**
   * @notice Add address to whitelist
   * @param account Address to whitelist
   */
  function addToWhitelist(address account) external onlyOwner {
    require(account != address(0), "PlanetTokenMinter: invalid address");
    whitelist[account] = true;
    emit WhitelistUpdated(account, true);
  }

  /**
   * @notice Remove address from whitelist
   * @param account Address to remove
   */
  function removeFromWhitelist(address account) external onlyOwner {
    whitelist[account] = false;
    emit WhitelistUpdated(account, false);
  }

  /**
   * @notice Batch update whitelist
   * @param accounts Array of addresses
   * @param allowed Array of boolean values
   */
  function batchUpdateWhitelist(address[] calldata accounts, bool[] calldata allowed) external onlyOwner {
    require(accounts.length == allowed.length, "PlanetTokenMinter: arrays length mismatch");
    for (uint256 i = 0; i < accounts.length; i++) {
      require(accounts[i] != address(0), "PlanetTokenMinter: invalid address");
      whitelist[accounts[i]] = allowed[i];
      emit WhitelistUpdated(accounts[i], allowed[i]);
    }
  }

  /**
   * @notice Toggle whitelist requirement
   * @param enabled Whether whitelist is required
   */
  function setWhitelistEnabled(bool enabled) external onlyOwner {
    whitelistEnabled = enabled;
    emit WhitelistToggled(enabled);
  }

  // ============ Configuration Functions ============

  /**
   * @notice Update mint price
   * @param newPrice New price per token in wei
   */
  function setMintPrice(uint256 newPrice) external onlyOwner {
    uint256 oldPrice = mintPrice;
    mintPrice = newPrice;
    emit MintPriceUpdated(oldPrice, newPrice);
  }

  /**
   * @notice Set price for specific planet level
   * @param level Planet level (1-9)
   * @param price Price in wei (0 = use default mintPrice)
   */
  function setLevelPrice(uint8 level, uint256 price) external onlyOwner validLevel(level) {
    levelPrice[level] = price;
    emit LevelPriceUpdated(level, price);
  }

  /**
   * @notice Update treasury address
   * @param newTreasury New treasury address
   */
  function setTreasury(address newTreasury) external onlyOwner {
    require(newTreasury != address(0), "PlanetTokenMinter: invalid treasury");
    address oldTreasury = treasury;
    treasury = newTreasury;
    emit TreasuryUpdated(oldTreasury, newTreasury);
  }

  /**
   * @notice Update max supply
   * @param newMaxSupply New maximum supply
   */
  function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
    require(newMaxSupply >= totalMinted, "PlanetTokenMinter: max supply too low");
    uint256 oldMax = maxSupply;
    maxSupply = newMaxSupply;
    emit MaxSupplyUpdated(oldMax, newMaxSupply);
  }

  /**
   * @notice Update max tokens per address
   * @param newMax New maximum tokens per address
   */
  function setMaxTokensPerAddress(uint256 newMax) external onlyOwner {
    uint256 oldMax = maxTokensPerAddress;
    maxTokensPerAddress = newMax;
    emit MaxTokensPerAddressUpdated(oldMax, newMax);
  }

  // ============ Pause Functions ============

  /**
   * @notice Pause all minting operations
   */
  function pause() external onlyOwner {
    _pause();
  }

  /**
   * @notice Unpause all minting operations
   */
  function unpause() external onlyOwner {
    _unpause();
  }

  // ============ View Functions ============

  /**
   * @notice Get remaining supply that can be minted
   * @return Remaining supply
   */
  function getRemainingSupply() external view returns (uint256) {
    return maxSupply > totalMinted ? maxSupply - totalMinted : 0;
  }

  /**
   * @notice Check if address is whitelisted
   * @param account Address to check
   * @return Whether address is whitelisted
   */
  function isWhitelisted(address account) external view returns (bool) {
    return whitelist[account];
  }

  /**
   * @notice Get price for specific level
   * @param level Planet level
   * @return Price in wei (returns default mintPrice if level price not set)
   */
  function getLevelPrice(uint8 level) external view returns (uint256) {
    if (levelPrice[level] > 0) {
      return levelPrice[level];
    }
    return mintPrice;
  }

  /**
   * @notice Calculate total cost for purchasing tokens
   * @param amount Amount of tokens
   * @param planetLevel Planet level
   * @return Total cost in wei
   */
  function calculateCost(uint256 amount, uint8 planetLevel) external view returns (uint256) {
    uint256 price = levelPrice[planetLevel] > 0 ? levelPrice[planetLevel] : mintPrice;
    return amount * price;
  }
}
