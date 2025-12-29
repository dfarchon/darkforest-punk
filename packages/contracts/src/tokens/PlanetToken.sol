// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";
import { IERC2981 } from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Base64 } from "@openzeppelin/contracts/utils/Base64.sol";
import { IPlanetToken } from "./IPlanetToken.sol";
import { Errors } from "interfaces/errors.sol";
import { PlanetType } from "codegen/common.sol";

/**
 * @notice ERC721 NFT token that represents celestial planets
 * @dev This token is minted EXTERNALLY (by other contracts/pages), not by the game
 *      Game contract only stakes/attaches these tokens
 *      Each token has unique tokenId with metadata: planet level and planetType
 */
contract PlanetToken is ERC721, Ownable, ERC2981 {
  mapping(address => bool) public minters;

  // Token metadata - each token holds level and planetType from mint
  mapping(uint256 => TokenMetadata) public tokenMetadata; // tokenId => metadata
  uint256 private _tokenIdCounter;

  uint96 public constant DEFAULT_ROYALTY_BPS = 500; // 5%
  uint96 public constant MAX_ROYALTY_BPS = 1000; // 10%

  struct TokenMetadata {
    uint8 level; // Planet level (1-9)
    PlanetType planetType; // Planet type (PLANET, ASTEROID_FIELD, FOUNDRY, etc.)
    // biome and spaceType are stored in game contract, not in token
  }

  // Planet type names for display
  mapping(PlanetType => string) public planetTypeNames;

  event MinterUpdated(address indexed minter, bool allowed);
  event TokensMinted(address indexed to, uint256 indexed tokenId, uint8 level, PlanetType planetType);

  modifier onlyMinter() {
    if (!minters[msg.sender]) revert Errors.NotMinter(msg.sender);
    _;
  }

  constructor() ERC721("PUNK PlanetToken", "PUNK") Ownable(msg.sender) {
    _setDefaultRoyalty(msg.sender, DEFAULT_ROYALTY_BPS);
    _initializePlanetTypeNames();
  }

  /**
   * @notice Initialize planet type names
   */
  function _initializePlanetTypeNames() internal {
    planetTypeNames[PlanetType.UNKNOWN] = "Unknown";
    planetTypeNames[PlanetType.PLANET] = "Planet";
    planetTypeNames[PlanetType.ASTEROID_FIELD] = "Asteroid Field";
    planetTypeNames[PlanetType.FOUNDRY] = "Foundry";
    planetTypeNames[PlanetType.SPACETIME_RIP] = "Spacetime Rip";
    planetTypeNames[PlanetType.QUASAR] = "Quasar";
    planetTypeNames[PlanetType.SUN] = "Sun";
    planetTypeNames[PlanetType.STARBASE] = "Starbase";
  }

  /**
   * @notice Mint a unique NFT token with planet level and type (called by external contracts/pages)
   * @param to Address to mint token to
   * @param planetLevel Planet level (1-9)
   * @param planetType Planet type (PLANET, ASTEROID_FIELD, etc.)
   * @return tokenId The unique token ID of the minted token
   * @dev Token holds level and planetType. Biome and spaceType are stored in game contract.
   */
  function mint(address to, uint8 planetLevel, PlanetType planetType) external onlyMinter returns (uint256) {
    require(planetLevel >= 1 && planetLevel <= 9, "PlanetToken: invalid level (1-9)");
    require(planetType != PlanetType.UNKNOWN, "PlanetToken: invalid planetType");

    uint256 tokenId = _tokenIdCounter++;
    _mint(to, tokenId);
    _setTokenMetadata(tokenId, planetLevel, planetType);
    emit TokensMinted(to, tokenId, planetLevel, planetType);
    return tokenId;
  }

  /**
   * @notice Batch mint multiple tokens
   * @param to Address to mint tokens to
   * @param planetLevels Array of planet levels
   * @param planetTypes Array of planet types
   * @return tokenIds Array of minted token IDs
   */
  function mintBatch(
    address to,
    uint8[] calldata planetLevels,
    PlanetType[] calldata planetTypes
  ) external onlyMinter returns (uint256[] memory) {
    require(planetLevels.length == planetTypes.length, "PlanetToken: arrays length mismatch");
    require(planetLevels.length > 0, "PlanetToken: empty arrays");

    uint256[] memory tokenIds = new uint256[](planetLevels.length);

    for (uint256 i = 0; i < planetLevels.length; i++) {
      require(planetLevels[i] >= 1 && planetLevels[i] <= 9, "PlanetToken: invalid level");
      require(planetTypes[i] != PlanetType.UNKNOWN, "PlanetToken: invalid planetType");

      uint256 tokenId = _tokenIdCounter++;
      _mint(to, tokenId);
      _setTokenMetadata(tokenId, planetLevels[i], planetTypes[i]);
      emit TokensMinted(to, tokenId, planetLevels[i], planetTypes[i]);
      tokenIds[i] = tokenId;
    }

    return tokenIds;
  }

  /**
   * @notice Set token metadata (internal helper to reduce stack depth)
   */
  function _setTokenMetadata(uint256 tokenId, uint8 level, PlanetType pType) internal {
    tokenMetadata[tokenId].level = level;
    tokenMetadata[tokenId].planetType = pType;
  }

  function setMinter(address minter, bool allowed) external onlyOwner {
    if (minter == address(0)) revert Errors.InvalidMinter(minter);
    minters[minter] = allowed;
    emit MinterUpdated(minter, allowed);
  }

  function isMinter(address account) external view returns (bool) {
    return minters[account];
  }

  function getTokenLevel(uint256 tokenId) external view returns (uint8) {
    require(_ownerOf(tokenId) != address(0), "PlanetToken: token does not exist");
    return tokenMetadata[tokenId].level;
  }

  function getTokenPlanetType(uint256 tokenId) external view returns (PlanetType) {
    require(_ownerOf(tokenId) != address(0), "PlanetToken: token does not exist");
    return tokenMetadata[tokenId].planetType;
  }

  function getTokenMetadata(uint256 tokenId) external view returns (uint8 level, PlanetType planetType) {
    require(_ownerOf(tokenId) != address(0), "PlanetToken: token does not exist");
    TokenMetadata memory metadata = tokenMetadata[tokenId];
    return (metadata.level, metadata.planetType);
  }

  /**
   * @notice Set planet type name for display
   * @param planetType Planet type enum
   * @param name Display name
   */
  function setPlanetTypeName(PlanetType planetType, string calldata name) external onlyOwner {
    planetTypeNames[planetType] = name;
  }

  /**
   * @notice Get token URI for a specific token ID (generates SVG metadata)
   * @param tokenId Token ID to get URI for
   * @return Base64-encoded JSON metadata with SVG image
   * @dev Generates on-chain SVG based on planet level and type
   */
  function tokenURI(uint256 tokenId) public view override returns (string memory) {
    require(_ownerOf(tokenId) != address(0), "PlanetToken: token does not exist");
    return _generateTokenURI(tokenId);
  }

  /**
   * @notice Generate token URI (internal helper to reduce stack depth)
   */
  function _generateTokenURI(uint256 tokenId) internal view returns (string memory) {
    TokenMetadata memory metadata = tokenMetadata[tokenId];
    string memory svg = _generateSVG(metadata.level, metadata.planetType, tokenId);
    return _generateJSON(svg, tokenId, metadata.level, metadata.planetType);
  }

  /**
   * @notice Generate SVG image (internal helper to reduce stack depth)
   */
  function _generateSVG(uint8 level, PlanetType planetType, uint256 tokenId) internal view returns (string memory) {
    string memory levelStr = Strings.toString(level);
    string memory tokenIdStr = Strings.toString(tokenId);
    string memory planetTypeName = _getPlanetTypeName(planetType);

    string memory svgPart1 = string(
      abi.encodePacked(
        '<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" viewBox="0 0 350 350"><style>.base { fill: white; font-family: serif; font-size: 14px; } .title { fill: white; font-family: serif; font-size: 18px; font-weight: bold; }</style><rect width="100%" height="100%" fill="black" /><text x="10" y="20" class="title">PUNK PlanetToken</text><text x="10" y="40" class="base">Dark Forest Punk</text><text x="10" y="60" class="base">Celestials Mirror</text><text x="10" y="80" class="base">ERC721 Planet NFT</text><text x="10" y="100" class="base">Token ID: #',
        tokenIdStr,
        '</text><text x="10" y="120" class="base">Planet Level: ',
        levelStr,
        '</text><text x="10" y="140" class="base">Planet Type: '
      )
    );

    return string(abi.encodePacked(svgPart1, planetTypeName, "</text></svg>"));
  }

  /**
   * @notice Generate JSON metadata (internal helper to reduce stack depth)
   */
  function _generateJSON(
    string memory svg,
    uint256 tokenId,
    uint8 level,
    PlanetType planetType
  ) internal view returns (string memory) {
    // Convert to strings first
    string memory tokenIdStr = Strings.toString(tokenId);
    string memory levelStr = Strings.toString(level);

    // Get planet type name
    string memory planetTypeName = _getPlanetTypeName(planetType);

    // Encode SVG to base64
    string memory svgBase64 = Base64.encode(bytes(svg));

    // Build JSON string parts
    string memory jsonPart1 = string(
      abi.encodePacked(
        '{"name": "PUNK PlanetToken #',
        tokenIdStr,
        '", "description": "Celestials Mirror - ERC721 NFT representing a celestial planet from Dark Forest Punk universe. Level: ',
        levelStr,
        ", Type: ",
        planetTypeName,
        '. This token can be staked to create planets in the game.", "image": "data:image/svg+xml;base64,'
      )
    );

    string memory jsonPart2 = string(
      abi.encodePacked(
        svgBase64,
        '", "attributes": [{"trait_type": "Planet Level", "value": ',
        levelStr,
        '}, {"trait_type": "Planet Type", "value": "',
        planetTypeName,
        '"}, {"trait_type": "Token ID", "value": ',
        tokenIdStr,
        '}, {"trait_type": "Token Type", "value": "ERC721"}, {"trait_type": "Symbol", "value": "PUNK"}]}'
      )
    );

    // Combine and encode
    string memory json = Base64.encode(bytes(string(abi.encodePacked(jsonPart1, jsonPart2))));
    return string(abi.encodePacked("data:application/json;base64,", json));
  }

  /**
   * @notice Get planet type name (internal helper)
   */
  function _getPlanetTypeName(PlanetType planetType) internal view returns (string memory) {
    string memory name = planetTypeNames[planetType];
    if (bytes(name).length == 0) {
      return string(abi.encodePacked("PlanetType #", Strings.toString(uint8(planetType))));
    }
    return name;
  }

  /**
   * @notice Set royalty recipient (treasury address or burn contract)
   * @param recipient The address that will receive royalties.
   *                  Can be a treasury address or an ETHBurner contract for ETH burn.
   *                  If set to an ETHBurner contract, royalties will be permanently burned.
   * @dev Setting to address(0) will revert. Use a valid address or deploy an ETHBurner contract.
   *      See ETHBurner.sol for burn contract implementation.
   */
  function setRoyaltyRecipient(address recipient) external onlyOwner {
    if (recipient == address(0)) {
      revert Errors.InvalidRecipient(recipient);
    }
    _setDefaultRoyalty(recipient, DEFAULT_ROYALTY_BPS);
  }

  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC2981) returns (bool) {
    return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
  }
}
