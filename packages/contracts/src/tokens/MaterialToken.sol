// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import { ERC1155URIStorage } from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { MaterialType } from "codegen/common.sol";
import { IMaterialToken } from "./IMaterialToken.sol";
import { SystemRegistry } from "@latticexyz/world/src/codegen/tables/SystemRegistry.sol";
import { ResourceId } from "@latticexyz/store/src/ResourceId.sol";
import { Player } from "codegen/tables/Player.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Base64 } from "@openzeppelin/contracts/utils/Base64.sol";
import { Errors } from "interfaces/errors.sol";

/**
 * @title MaterialToken
 * @dev ERC1155 token contract for Dark Forest Punk materials with ERC2981 royalty support
 * @notice Materials withdrawn from Spacetime Rips are minted as ERC1155 tokens.
 * Each material type has its own token ID, and royalties are calculated based on material value.
 */

contract MaterialToken is Ownable, ERC2981, ERC1155URIStorage {
  // ============ Constants ============

  /// @notice Base token ID offset (to avoid conflicts with other token systems)
  uint256 public constant BASE_TOKEN_ID = 0;

  /// @notice Default royalty percentage in basis points (500 = 5%)
  uint96 public constant DEFAULT_ROYALTY_BPS = 500;

  /// @notice Maximum allowed royalty percentage in basis points (1000 = 10%)
  uint96 public constant MAX_ROYALTY_BPS = 1000;

  // ============ Modifiers ============

  modifier exists(uint256 tokenId) {
    // Check if token ID is in valid range (BASE_TOKEN_ID to BASE_TOKEN_ID + SOLAR_ENERGY)
    // This allows UNKNOWN (0) material type to pass validation
    if (tokenId < BASE_TOKEN_ID || tokenId > BASE_TOKEN_ID + uint256(MaterialType.SOLAR_ENERGY)) {
      revert Errors.InvalidTokenId(tokenId);
    }
    _;
  }

  // Material type to token ID mapping
  mapping(MaterialType => uint256) public materialTypeToTokenId;

  // Token ID to material type mapping
  mapping(uint256 => MaterialType) public tokenIdToMaterialType;

  // Royalty recipient (game treasury)
  address public royaltyRecipient;

  // Default royalty percentage in basis points
  uint96 public defaultRoyaltyBps = DEFAULT_ROYALTY_BPS;

  // Per-token royalty rates (optional override)
  mapping(uint256 => uint96) public tokenRoyaltyBps;

  // Minter role (only authorized systems can mint)
  mapping(address => bool) public minters;

  // Material names
  mapping(MaterialType => string) public materialNames;

  // Material icon URIs (PNG images - data URI, IPFS, or HTTP)
  mapping(MaterialType => string) public materialIconURIs;

  event MaterialTokenURIUpdated(uint256 indexed tokenId, string tokenURI);
  event MaterialIconURIUpdated(MaterialType indexed materialType, string iconURI);
  event MinterAdded(address indexed minter);
  event MinterRemoved(address indexed minter);
  event MaterialMinted(address indexed to, MaterialType indexed materialType, uint256 tokenId, uint256 amount);
  event RoyaltyRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
  event DefaultRoyaltyUpdated(uint96 oldBps, uint96 newBps);
  event TokenRoyaltyUpdated(uint256 indexed tokenId, uint96 royaltyBps);

  modifier onlyMinter() {
    if (!minters[_msgSender()]) {
      revert Errors.NotMinter(_msgSender());
    }
    _;
  }

  constructor(string memory baseURI, address _royaltyRecipient) ERC1155(baseURI) Ownable(msg.sender) {
    royaltyRecipient = _royaltyRecipient;
    _setDefaultRoyalty(_royaltyRecipient, defaultRoyaltyBps);
    _initializeTokenIds();
    _initializeMaterialNames();
  }

  /**
   * @notice Modifier to ensure the caller is a registered player
   */
  modifier onlyPlayer() {
    if (Player.getIndex(_msgSender()) == 0) {
      revert Errors.NotPlayer(_msgSender());
    }
    _;
  }
  /**
   * @notice Initialize token ID mappings for all material types
   */
  function _initializeTokenIds() internal {
    materialTypeToTokenId[MaterialType.UNKNOWN] = BASE_TOKEN_ID + uint256(MaterialType.UNKNOWN);
    materialTypeToTokenId[MaterialType.WATER_CRYSTALS] = BASE_TOKEN_ID + uint256(MaterialType.WATER_CRYSTALS);
    materialTypeToTokenId[MaterialType.LIVING_WOOD] = BASE_TOKEN_ID + uint256(MaterialType.LIVING_WOOD);
    materialTypeToTokenId[MaterialType.WINDSTEEL] = BASE_TOKEN_ID + uint256(MaterialType.WINDSTEEL);
    materialTypeToTokenId[MaterialType.AURORIUM] = BASE_TOKEN_ID + uint256(MaterialType.AURORIUM);
    materialTypeToTokenId[MaterialType.MYCELIUM] = BASE_TOKEN_ID + uint256(MaterialType.MYCELIUM);
    materialTypeToTokenId[MaterialType.SANDGLASS] = BASE_TOKEN_ID + uint256(MaterialType.SANDGLASS);
    materialTypeToTokenId[MaterialType.CRYOSTONE] = BASE_TOKEN_ID + uint256(MaterialType.CRYOSTONE);
    materialTypeToTokenId[MaterialType.SCRAPIUM] = BASE_TOKEN_ID + uint256(MaterialType.SCRAPIUM);
    materialTypeToTokenId[MaterialType.PYROSTEEL] = BASE_TOKEN_ID + uint256(MaterialType.PYROSTEEL);
    materialTypeToTokenId[MaterialType.BLACKALLOY] = BASE_TOKEN_ID + uint256(MaterialType.BLACKALLOY);
    materialTypeToTokenId[MaterialType.CORRUPTED_CRYSTAL] = BASE_TOKEN_ID + uint256(MaterialType.CORRUPTED_CRYSTAL);
    materialTypeToTokenId[MaterialType.SOLAR_ENERGY] = BASE_TOKEN_ID + uint256(MaterialType.SOLAR_ENERGY);

    // Reverse mapping
    for (uint256 i = 0; i <= uint256(MaterialType.SOLAR_ENERGY); i++) {
      uint256 tokenId = BASE_TOKEN_ID + i;
      tokenIdToMaterialType[tokenId] = MaterialType(i);
    }
  }

  /**
   * @notice Initialize material names
   */
  function _initializeMaterialNames() internal {
    materialNames[MaterialType.UNKNOWN] = "Unknown Material";
    materialNames[MaterialType.WATER_CRYSTALS] = "Water Crystals";
    materialNames[MaterialType.LIVING_WOOD] = "Living Wood";
    materialNames[MaterialType.WINDSTEEL] = "Windsteel";
    materialNames[MaterialType.AURORIUM] = "Aurorium";
    materialNames[MaterialType.MYCELIUM] = "Mycelium";
    materialNames[MaterialType.SANDGLASS] = "Sandglass";
    materialNames[MaterialType.CRYOSTONE] = "Cryostone";
    materialNames[MaterialType.SCRAPIUM] = "Scrapium";
    materialNames[MaterialType.PYROSTEEL] = "Pyrosteel";
    materialNames[MaterialType.BLACKALLOY] = "Blackalloy";
    materialNames[MaterialType.CORRUPTED_CRYSTAL] = "Corrupted Crystal";
    materialNames[MaterialType.SOLAR_ENERGY] = "Solar Energy";
  }

  /**
   * @dev See {IERC165-supportsInterface}.
   * Combines ERC1155 and ERC2981 interface support.
   */
  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, ERC2981) returns (bool) {
    return ERC1155.supportsInterface(interfaceId) || ERC2981.supportsInterface(interfaceId);
  }

  // ============ Minting Functions ============

  /**
   * @notice Mint material tokens (only authorized minters)
   * @param to Address to mint tokens to
   * @param materialType Material type to mint
   * @param amount Amount of material to mint
   * @param data Additional data
   */
  function mint(address to, MaterialType materialType, uint256 amount, bytes memory data) public onlyMinter {
    uint256 tokenId = getTokenId(materialType);
    _mint(to, tokenId, amount, data);
    emit MaterialMinted(to, materialType, tokenId, amount);
  }

  /**
   * @notice Mint multiple material types in batch
   * @param to Address to mint tokens to
   * @param materialTypes Array of material types
   * @param amounts Array of amounts (must match materialTypes length)
   * @param data Additional data
   */
  function mintBatch(
    address to,
    MaterialType[] memory materialTypes,
    uint256[] memory amounts,
    bytes memory data
  ) public onlyMinter {
    if (materialTypes.length != amounts.length) {
      revert Errors.ArraysLengthMismatch(materialTypes.length, amounts.length);
    }

    uint256[] memory tokenIds = new uint256[](materialTypes.length);
    for (uint256 i = 0; i < materialTypes.length; i++) {
      tokenIds[i] = getTokenId(materialTypes[i]);
    }

    _mintBatch(to, tokenIds, amounts, data);

    for (uint256 i = 0; i < materialTypes.length; i++) {
      emit MaterialMinted(to, materialTypes[i], tokenIds[i], amounts[i]);
    }
  }

  /**
   * @notice Burn material tokens (for depositing back to game)
   * @param from Address to burn tokens from
   * @param materialType Material type to burn
   * @param amount Amount of material to burn
   */
  function burn(address from, MaterialType materialType, uint256 amount) public {
    uint256 tokenId = getTokenId(materialType);
    if (from != _msgSender() && !isApprovedForAll(from, _msgSender())) {
      revert Errors.NotOwnerNorApproved(_msgSender(), from);
    }
    _burn(from, tokenId, amount);
  }

  /**
   * @notice Burn multiple material types in batch
   * @param from Address to burn tokens from
   * @param materialTypes Array of material types
   * @param amounts Array of amounts
   */
  function burnBatch(address from, MaterialType[] memory materialTypes, uint256[] memory amounts) public {
    if (from != _msgSender() && !isApprovedForAll(from, _msgSender())) {
      revert Errors.NotOwnerNorApproved(_msgSender(), from);
    }
    if (materialTypes.length != amounts.length) {
      revert Errors.ArraysLengthMismatch(materialTypes.length, amounts.length);
    }

    uint256[] memory tokenIds = new uint256[](materialTypes.length);
    for (uint256 i = 0; i < materialTypes.length; i++) {
      tokenIds[i] = getTokenId(materialTypes[i]);
    }

    _burnBatch(from, tokenIds, amounts);
  }

  // ============ Token ID Functions ============

  /**
   * @notice Get token ID for a material type
   * @param materialType Material type
   * @return tokenId Token ID
   */
  function getTokenId(MaterialType materialType) public pure returns (uint256) {
    return BASE_TOKEN_ID + uint256(materialType);
  }

  /**
   * @notice Get material type for a token ID
   * @param tokenId Token ID
   * @return materialType Material type
   */
  function getMaterialType(uint256 tokenId) public view returns (MaterialType) {
    if (tokenId < BASE_TOKEN_ID || tokenId > BASE_TOKEN_ID + uint256(MaterialType.SOLAR_ENERGY)) {
      revert Errors.InvalidTokenId(tokenId);
    }
    MaterialType materialType = tokenIdToMaterialType[tokenId];
    return materialType;
  }

  /**
   * @notice Get material name for a material type
   * @param materialType Material type
   * @return name Material name
   */
  function getMaterialName(MaterialType materialType) public view returns (string memory) {
    return materialNames[materialType];
  }

  /**
   * @notice Set icon URI for a material type
   * @param materialType Material type
   * @param iconURI Icon URI (data URI, IPFS, or HTTP)
   */
  function setMaterialIconURI(MaterialType materialType, string memory iconURI) public onlyOwner {
    materialIconURIs[materialType] = iconURI;
    emit MaterialIconURIUpdated(materialType, iconURI);
  }

  /**
   * @notice Set icon URIs for multiple material types
   * @param materialTypes Array of material types
   * @param iconURIs Array of icon URIs
   */
  function setMaterialIconURIs(MaterialType[] memory materialTypes, string[] memory iconURIs) public onlyOwner {
    if (materialTypes.length != iconURIs.length) {
      revert Errors.ArraysLengthMismatch(materialTypes.length, iconURIs.length);
    }
    for (uint256 i = 0; i < materialTypes.length; i++) {
      materialIconURIs[materialTypes[i]] = iconURIs[i];
      emit MaterialIconURIUpdated(materialTypes[i], iconURIs[i]);
    }
  }

  /**
   * @notice Get icon URI for a material type
   * @param materialType Material type
   * @return iconURI Icon URI
   */
  function getMaterialIconURI(MaterialType materialType) public view returns (string memory) {
    return materialIconURIs[materialType];
  }

  // ============ ERC2981 Royalty Functions ============

  /**
   * @notice Override royalty info to support material-based royalties
   * @dev Implements ERC2981 royalty standard
   * @param tokenId The token ID to query royalty info for
   * @param salePrice The sale price of the token
   * @return receiver The address that should receive the royalty
   * @return royaltyAmount The amount of royalty to be paid
   */
  function royaltyInfo(
    uint256 tokenId,
    uint256 salePrice
  ) public view virtual override returns (address receiver, uint256 royaltyAmount) {
    // Check if token-specific royalty is set
    uint96 royaltyBps = tokenRoyaltyBps[tokenId];

    // If no token-specific royalty, use material-based royalty
    if (royaltyBps == 0) {
      MaterialType materialType = getMaterialType(tokenId);
      royaltyBps = _getMaterialRoyalty(materialType);
    }

    // If still no royalty, use default
    if (royaltyBps == 0) {
      royaltyBps = defaultRoyaltyBps;
    }

    royaltyAmount = (salePrice * uint256(royaltyBps)) / _feeDenominator();
    return (royaltyRecipient, royaltyAmount);
  }

  /**
   * @notice Calculate royalty based on material type value
   * @param materialType Material type
   * @return royaltyBps Royalty in basis points (500 = 5%)
   * @dev Currently all materials use 5% royalty. Structure supports future value-based differentiation.
   */
  function _getMaterialRoyalty(MaterialType materialType) internal pure returns (uint96) {
    // All materials currently use DEFAULT_ROYALTY_BPS (5%)
    // Future enhancement: Differentiate by material value (600x, 400x, 300x multipliers, etc.)
    if (materialType == MaterialType.CORRUPTED_CRYSTAL) return DEFAULT_ROYALTY_BPS; // 5% (premium: 600x multiplier)
    if (materialType == MaterialType.BLACKALLOY) return DEFAULT_ROYALTY_BPS; // 5% (premium: 400x multiplier)
    if (materialType == MaterialType.PYROSTEEL) return DEFAULT_ROYALTY_BPS; // 5% (high: 300x multiplier)
    if (materialType == MaterialType.SCRAPIUM) return DEFAULT_ROYALTY_BPS; // 5% (high: 250x multiplier)
    if (materialType == MaterialType.CRYOSTONE) return DEFAULT_ROYALTY_BPS; // 5% (medium: 200x multiplier)
    if (materialType == MaterialType.SANDGLASS) return DEFAULT_ROYALTY_BPS; // 5% (medium: 180x multiplier)
    if (materialType == MaterialType.MYCELIUM) return DEFAULT_ROYALTY_BPS; // 5% (medium: 150x multiplier)
    if (materialType == MaterialType.AURORIUM) return DEFAULT_ROYALTY_BPS; // 5% (medium: 130x multiplier)
    if (materialType == MaterialType.SOLAR_ENERGY) return DEFAULT_ROYALTY_BPS; // 5% (medium: TBD multiplier)
    if (materialType == MaterialType.WINDSTEEL) return DEFAULT_ROYALTY_BPS; // 5% (standard: 120x multiplier)
    if (materialType == MaterialType.LIVING_WOOD) return DEFAULT_ROYALTY_BPS; // 5% (standard: 110x multiplier)
    if (materialType == MaterialType.WATER_CRYSTALS) return DEFAULT_ROYALTY_BPS; // 5% (common: 105x multiplier)
    return DEFAULT_ROYALTY_BPS; // 5% default (UNKNOWN and others)
  }

  /**
   * @notice Set royalty recipient (treasury address or burn contract)
   * @param _recipient The address that will receive royalties.
   *                   Can be a treasury address or an ETHBurner contract for ETH burn.
   *                   If set to an ETHBurner contract, royalties will be permanently burned.
   * @dev Setting to address(0) is not allowed. Use a valid address or deploy an ETHBurner contract.
   *      See ETHBurner.sol for burn contract implementation.
   */
  function setRoyaltyRecipient(address _recipient) public onlyOwner {
    if (_recipient == address(0)) {
      revert Errors.InvalidRecipient(_recipient);
    }
    address oldRecipient = royaltyRecipient;
    royaltyRecipient = _recipient;
    _setDefaultRoyalty(_recipient, defaultRoyaltyBps);
    emit RoyaltyRecipientUpdated(oldRecipient, _recipient);
  }

  /**
   * @notice Set default royalty percentage
   * @param _royaltyBps Royalty in basis points (10000 = 100%, max 1000 = 10%)
   */
  function setDefaultRoyalty(uint96 _royaltyBps) public onlyOwner {
    if (_royaltyBps > MAX_ROYALTY_BPS) {
      revert Errors.RoyaltyTooHigh(_royaltyBps, MAX_ROYALTY_BPS);
    }
    uint96 oldBps = defaultRoyaltyBps;
    defaultRoyaltyBps = _royaltyBps;
    _setDefaultRoyalty(royaltyRecipient, _royaltyBps);
    emit DefaultRoyaltyUpdated(oldBps, _royaltyBps);
  }

  /**
   * @notice Set custom royalty for a specific token ID
   * @param tokenId Token ID
   * @param royaltyBps Royalty in basis points (max 1000 = 10%)
   */
  function setTokenRoyalty(uint256 tokenId, uint96 royaltyBps) public onlyOwner {
    if (royaltyBps > 1000) {
      revert Errors.RoyaltyTooHigh(royaltyBps, 1000);
    }
    tokenRoyaltyBps[tokenId] = royaltyBps;
    emit TokenRoyaltyUpdated(tokenId, royaltyBps);
  }

  /**
   * @notice Reset token royalty to use material-based/default royalty
   * @param tokenId Token ID
   */
  function resetTokenRoyalty(uint256 tokenId) public onlyOwner {
    delete tokenRoyaltyBps[tokenId];
    emit TokenRoyaltyUpdated(tokenId, 0);
  }

  // ============ Minter Management ============

  /**
   * @notice Add a minter address (authorized system)
   * @param minter Address to add as minter
   */
  function addMinter(address minter) public onlyOwner {
    if (minter == address(0)) {
      revert Errors.InvalidMinter(minter);
    }
    minters[minter] = true;
    emit MinterAdded(minter);
  }

  /**
   * @notice Get if a minter is a system minter
   * @param minter Address to check
   * @return bool True if the address is a minter, false otherwise
   */
  function getSystemMinter(address minter) public view returns (bool) {
    return minters[minter];
  }
  /**
   * @notice Add a minter address with system validation (only registered systems)
   * @param minter Address to add as minter (must be a registered system)
   */
  function addSystemMinter(address minter) public onlyOwner {
    if (minter == address(0)) {
      revert Errors.InvalidMinter(minter);
    }

    // Validate that the address is a registered system
    ResourceId resourceId = SystemRegistry.get(minter);
    if (ResourceId.unwrap(resourceId) == bytes32(0)) {
      revert Errors.NotRegisteredSystem(minter);
    }

    minters[minter] = true;
    emit MinterAdded(minter);
  }

  /**
   * @notice Remove a minter address
   * @param minter Address to remove as minter
   */
  function removeMinter(address minter) public onlyOwner {
    minters[minter] = false;
    emit MinterRemoved(minter);
  }

  // ============ Metadata Functions ============

  /**
   * @notice Set base URI for all tokens
   * @param baseURI Base URI
   */
  function setBaseURI(string memory baseURI) public onlyOwner {
    _setURI(baseURI);
  }

  /**
   * @notice Set URI for all tokens using auto-generated metadata
   * @dev This pre-computes and stores the URI for each material token
   *      so that uri() returns the stored value instead of generating on-the-fly
   *      Uses tokenURI() to generate SVG-based metadata for each token
   */
  function setAllTokenURI() public onlyOwner {
    for (uint256 i = 0; i <= uint256(MaterialType.SOLAR_ENERGY); i++) {
      uint256 tokenId = BASE_TOKEN_ID + i;
      string memory generatedURI = tokenURI(tokenId); // Get the auto-generated URI (SVG-based)
      _setURI(tokenId, generatedURI); // Store it so uri() returns it directly
      emit MaterialTokenURIUpdated(tokenId, generatedURI);
    }
  }
  /**
   * @notice Get material name for a token ID
   * @param tokenId Token ID
   * @return name Material name
   */
  function getTokenName(uint256 tokenId) public view returns (string memory) {
    MaterialType materialType = getMaterialType(tokenId);
    return getMaterialName(materialType);
  }

  function tokenURI(uint256 tokenId) public view exists(tokenId) returns (string memory) {
    MaterialType materialType = getMaterialType(tokenId);
    string memory materialName = getTokenName(tokenId);
    string memory iconURI = materialIconURIs[materialType];

    string[13] memory parts;

    parts[
      0
    ] = '<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" viewBox="0 0 350 350"><style>.base { fill: white; font-family: serif; font-size: 14px; }</style><rect width="100%" height="100%" fill="black" /><text x="10" y="20" class="base">';

    parts[1] = "Dark Forest Punk";

    parts[2] = '</text><text x="10" y="40" class="base">';

    parts[3] = "Dark Forest community rounds";

    parts[4] = '</text><text x="10" y="60" class="base">';

    parts[5] = "built on zkSNARKs &amp; MUD engine";

    parts[6] = '</text><text x="10" y="80" class="base">';

    parts[7] = "Onchain Reality Universe Materials";

    parts[8] = '</text><text x="10" y="100" class="base">';

    parts[9] = materialName;

    parts[10] = "</text></svg>";

    string memory output = string(
      abi.encodePacked(parts[0], parts[1], parts[2], parts[3], parts[4], parts[5], parts[6], parts[7], parts[8])
    );
    output = string(abi.encodePacked(output, parts[9], parts[10]));

    // Build JSON metadata with optional icon URI
    string memory imageField;
    if (bytes(iconURI).length > 0) {
      // Use PNG icon if available
      imageField = string(
        abi.encodePacked(
          '"image": "',
          iconURI,
          '", "image_data": "data:image/svg+xml;base64,',
          Base64.encode(bytes(output)),
          '"'
        )
      );
    } else {
      // Fallback to SVG
      imageField = string(abi.encodePacked('"image": "data:image/svg+xml;base64,', Base64.encode(bytes(output)), '"'));
    }

    string memory json = Base64.encode(
      bytes(
        string(
          abi.encodePacked(
            '{"name": "',
            materialName,
            '", "description": "Material token from Dark Forest Punk universe. This material was extracted from Spacetime Rips.", ',
            imageField,
            "}"
          )
        )
      )
    );
    output = string(abi.encodePacked("data:application/json;base64,", json));

    return output;
  }
}
