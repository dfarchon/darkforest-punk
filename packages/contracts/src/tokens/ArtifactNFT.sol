// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";
import { IStoreRead } from "@latticexyz/store/src/IStoreRead.sol";
import { Systems } from "@latticexyz/world/src/codegen/tables/Systems.sol";
import { WorldResourceIdLib } from "@latticexyz/world/src/WorldResourceId.sol";
import { RESOURCE_SYSTEM } from "@latticexyz/world/src/worldResourceTypes.sol";
import { ResourceId } from "@latticexyz/store/src/ResourceId.sol";
import { IArtifactNFT } from "./IArtifactNFT.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { Base64 } from "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title ArtifactNFT
 * @dev A contract for managing Artifact NFTs with ERC2981 royalty support
 * @notice This contract implements ERC721 with ERC2981 NFT Royalty Standard.
 * Royalties are calculated based on artifact rarity by default, but can be
 * customized per token or per artifact type.
 */
contract ArtifactNFT is Ownable, ERC721Enumerable, ERC2981, IArtifactNFT {
  // ============ Constants ============

  bytes14 constant DF_NAMESPACE = "df";
  bytes16 constant ARTIFACT_PORTAL_SYSTEM_NAME = "ArtifactPortalSy";

  /// @notice Default royalty percentage in basis points (500 = 5%)
  uint96 public constant DEFAULT_ROYALTY_BPS = 500;

  /// @notice Maximum allowed royalty percentage in basis points (1000 = 10%)
  uint96 public constant MAX_ROYALTY_BPS = 1000;

  // ============ Modifiers ============

  modifier exists(uint256 tokenId) {
    require(_ownerOf(tokenId) != address(0), "invalid tokenId");
    _;
  }

  struct Artifact {
    uint8 index;
    uint8 rarity;
    uint8 biome;
  }

  mapping(uint8 round => address world) public dfs;
  mapping(address world => bool isDF) public isDF;
  mapping(uint256 tokenId => Artifact artifact) public artifacts;
  mapping(uint8 => string) artifactTypeNames;
  mapping(uint8 => string) artifactRarityNames;
  mapping(uint8 => string) biomeNames;

  // ERC2981 Royalty Configuration
  /// @notice Default royalty recipient (game treasury)
  address public royaltyRecipient;

  /// @notice Default royalty percentage in basis points
  uint96 public defaultRoyaltyBps = DEFAULT_ROYALTY_BPS;

  /// @notice Per-artifact-type royalty rates (optional override)
  mapping(uint8 => uint96) public artifactTypeRoyaltyBps;

  /// @notice Whether to use rarity-based royalties (true) or default (false)
  bool public useRarityBasedRoyalties = true;

  event DFUpdated(uint8 indexed round, address indexed world);
  event Minted(address indexed to, uint256 indexed tokenId);
  event RoyaltyRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
  event DefaultRoyaltyUpdated(uint96 oldBps, uint96 newBps);
  event ArtifactTypeRoyaltyUpdated(uint8 indexed artifactType, uint96 royaltyBps);
  event RarityBasedRoyaltiesToggled(bool enabled);

  modifier onlyDFCanMint(uint256 tokenId) {
    uint8 round = uint8(tokenId >> 24);
    require(_getDFArtifactSystemAddress(dfs[round]) == msg.sender, "mint: not artifact portal system");
    _;
  }

  modifier onlyDFCanDeposit(address world) {
    require(isDF[world], "depositFrom: to non-df address");
    require(_getDFArtifactSystemAddress(world) == msg.sender, "depositFrom: not artifact portal system");
    _;
  }

  constructor() Ownable(msg.sender) ERC721("DFArtifact", "DFATF") {
    royaltyRecipient = msg.sender; // Set to owner initially, can be changed to treasury
    _setDefaultRoyalty(royaltyRecipient, defaultRoyaltyBps);
  }

  /**
   * Mint function for minting Artifact NFTs
   * @param to address owns the minted NFT
   * @param tokenId tokenId of the minted NFT
   * @param artifactIndex index of the artifact
   * @param artifactRarity rarity of the artifact
   */
  function mint(
    address to,
    uint256 tokenId,
    uint8 artifactIndex,
    uint8 artifactRarity,
    uint8 biome
  ) public onlyDFCanMint(tokenId) {
    _safeMint(to, tokenId);
    artifacts[tokenId] = Artifact({ index: artifactIndex, rarity: artifactRarity, biome: biome });
    emit Minted(to, tokenId);
  }

  /**
   * Deposit function for depositing Artifact NFTs from player's wallet to df world
   * Only DF artifact portal system can deposit player's NFTs to df world.
   * Players don't need to approve NFTs to the portal system contract.
   * @param to df world address
   * @param tokenId tokenId of the deposited NFT
   * @param from player's address
   */
  function depositFrom(address to, uint256 tokenId, address from) public onlyDFCanDeposit(to) {
    // df world not implements {IERC721Receiver-onERC721Received}
    _transfer(from, to, tokenId);
  }

  function setDF(uint8 round, address world) public onlyOwner {
    if (dfs[round] != address(0)) {
      isDF[dfs[round]] = false;
    }
    dfs[round] = world;
    isDF[world] = true;
    emit DFUpdated(round, world);
  }

  function getArtifact(uint256 tokenId) public view returns (uint8 index, uint8 rarity, uint8 biome) {
    Artifact storage artifact = artifacts[tokenId];
    return (artifact.index, artifact.rarity, artifact.biome);
  }

  function isApprovedForAll(
    address owner,
    address operator
  ) public view virtual override(ERC721, IERC721) returns (bool) {
    return super.isApprovedForAll(owner, operator) || (isDF[owner] && _getDFArtifactSystemAddress(owner) == operator);
  }

  /**
   * @dev See {IERC165-supportsInterface}.
   * Combines ERC721Enumerable and ERC2981 interface support.
   */
  function supportsInterface(
    bytes4 interfaceId
  ) public view virtual override(IERC165, ERC721Enumerable, ERC2981) returns (bool) {
    return ERC721Enumerable.supportsInterface(interfaceId) || ERC2981.supportsInterface(interfaceId);
  }

  function _getDFArtifactSystemAddress(address world) internal view returns (address) {
    bytes32[] memory _keyTuple = new bytes32[](1);
    _keyTuple[0] = ResourceId.unwrap(
      WorldResourceIdLib.encode({ typeId: RESOURCE_SYSTEM, namespace: DF_NAMESPACE, name: ARTIFACT_PORTAL_SYSTEM_NAME })
    );
    bytes32 _blob = IStoreRead(world).getStaticField(Systems._tableId, _keyTuple, 0, Systems._fieldLayout);
    return (address(bytes20(_blob)));
  }

  function setArtifactTypeNames(uint8 index, string memory name) public onlyOwner {
    artifactTypeNames[index] = name;
  }

  function setArtifactRarityNames(uint8 rarity, string memory name) public onlyOwner {
    artifactRarityNames[rarity] = name;
  }

  function setBiomeNames(uint8 biome, string memory name) public onlyOwner {
    biomeNames[biome] = name;
  }

  function bulkSetArtifactTypeNames(uint8[] memory indices, string[] memory names) public onlyOwner {
    for (uint8 i = 0; i < indices.length; i++) {
      artifactTypeNames[indices[i]] = names[i];
    }
  }

  function bulkSetArtifactRarityNames(uint8[] memory rarities, string[] memory names) public onlyOwner {
    for (uint8 i = 0; i < rarities.length; i++) {
      artifactRarityNames[rarities[i]] = names[i];
    }
  }

  function bulkSetBiomeNames(uint8[] memory biomes, string[] memory names) public onlyOwner {
    for (uint8 i = 0; i < biomes.length; i++) {
      biomeNames[biomes[i]] = names[i];
    }
  }

  // ============ ERC2981 Royalty Functions ============

  /**
   * @notice Override royalty info to support rarity-based royalties
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
    // First check if there's a token-specific royalty set
    (address tokenReceiver, uint256 tokenRoyaltyAmount) = super.royaltyInfo(tokenId, salePrice);

    // If token-specific royalty is set, use it
    if (tokenReceiver != address(0) && tokenRoyaltyAmount > 0) {
      return (tokenReceiver, tokenRoyaltyAmount);
    }

    // Get artifact data
    Artifact memory artifact = artifacts[tokenId];

    // Check for artifact-type-specific royalty
    uint96 royaltyBps = artifactTypeRoyaltyBps[artifact.index];

    // If no type-specific royalty and rarity-based royalties are enabled, use rarity
    if (royaltyBps == 0 && useRarityBasedRoyalties) {
      royaltyBps = _getRarityRoyalty(artifact.rarity);
    }

    // If still no royalty, use default
    if (royaltyBps == 0) {
      royaltyBps = defaultRoyaltyBps;
    }

    royaltyAmount = (salePrice * uint256(royaltyBps)) / _feeDenominator();
    return (royaltyRecipient, royaltyAmount);
  }

  /**
   * @notice Calculate royalty based on artifact rarity
   * @param rarity The artifact rarity (0=Common, 1=Rare, 2=Epic, 3=Legendary, 4=Mythic)
   * @return royaltyBps Royalty in basis points (500 = 5%)
   * @dev Currently all rarities use 5% royalty. Structure supports future rarity-based differentiation.
   */
  function _getRarityRoyalty(uint8 rarity) internal pure returns (uint96) {
    // All rarities currently use DEFAULT_ROYALTY_BPS (5%)
    // Future enhancement: Differentiate by rarity (Common: 2%, Rare: 2.5%, Epic: 3%, Legendary: 4%, Mythic: 5%)
    if (rarity == 0) return DEFAULT_ROYALTY_BPS; // Common: 5%
    if (rarity == 1) return DEFAULT_ROYALTY_BPS; // Rare: 5%
    if (rarity == 2) return DEFAULT_ROYALTY_BPS; // Epic: 5%
    if (rarity == 3) return DEFAULT_ROYALTY_BPS; // Legendary: 5%
    if (rarity == 4) return DEFAULT_ROYALTY_BPS; // Mythic: 5%
    return DEFAULT_ROYALTY_BPS; // Default 5%
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
    require(_recipient != address(0), "Invalid recipient");
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
    require(_royaltyBps <= MAX_ROYALTY_BPS, "Royalty too high"); // Max 10%
    uint96 oldBps = defaultRoyaltyBps;
    defaultRoyaltyBps = _royaltyBps;
    _setDefaultRoyalty(royaltyRecipient, _royaltyBps);
    emit DefaultRoyaltyUpdated(oldBps, _royaltyBps);
  }

  /**
   * @notice Set custom royalty for specific artifact types
   * @param artifactType Artifact type (1-23)
   * @param royaltyBps Royalty in basis points (max 1000 = 10%)
   */
  function setArtifactTypeRoyalty(uint8 artifactType, uint96 royaltyBps) public onlyOwner {
    require(royaltyBps <= MAX_ROYALTY_BPS, "Royalty too high");
    artifactTypeRoyaltyBps[artifactType] = royaltyBps;
    emit ArtifactTypeRoyaltyUpdated(artifactType, royaltyBps);
  }

  /**
   * @notice Set royalty for a specific token (overrides all other royalty settings)
   * @param tokenId The token ID
   * @param receiver The address that will receive royalties
   * @param royaltyBps Royalty in basis points (max 1000 = 10%)
   */
  function setTokenRoyalty(uint256 tokenId, address receiver, uint96 royaltyBps) public onlyOwner {
    require(royaltyBps <= MAX_ROYALTY_BPS, "Royalty too high");
    require(receiver != address(0), "Invalid receiver");
    _setTokenRoyalty(tokenId, receiver, royaltyBps);
  }

  /**
   * @notice Reset token royalty to use default/rarity-based royalty
   * @param tokenId The token ID
   */
  function resetTokenRoyalty(uint256 tokenId) public onlyOwner {
    _resetTokenRoyalty(tokenId);
  }

  /**
   * @notice Toggle rarity-based royalties on/off
   * @param enabled If true, uses rarity-based royalties; if false, uses default royalty
   */
  function setUseRarityBasedRoyalties(bool enabled) public onlyOwner {
    useRarityBasedRoyalties = enabled;
    emit RarityBasedRoyaltiesToggled(enabled);
  }

  /**
   * @notice Get royalty info for a specific token (public view function)
   * @param tokenId The token ID
   * @param salePrice The sale price
   * @return receiver The address that will receive royalties
   * @return royaltyAmount The royalty amount
   */
  function getRoyaltyInfo(
    uint256 tokenId,
    uint256 salePrice
  ) public view returns (address receiver, uint256 royaltyAmount) {
    return royaltyInfo(tokenId, salePrice);
  }

  function tokenURI(uint256 tokenId) public view override exists(tokenId) returns (string memory) {
    (uint8 index, uint8 rarity, uint8 biome) = getArtifact(tokenId);

    // Get artifact type name, with fallback if not set
    string memory artifactType = artifactTypeNames[index];
    if (bytes(artifactType).length == 0) {
      artifactType = string(abi.encodePacked("Artifact Type #", Strings.toString(index)));
    }

    // Get artifact rarity name, with fallback if not set
    string memory artifactRarity = artifactRarityNames[rarity];
    if (bytes(artifactRarity).length == 0) {
      artifactRarity = string(abi.encodePacked("Rarity #", Strings.toString(rarity)));
    }

    // Get biome name, with fallback if not set
    string memory biomeName = biomeNames[biome];
    if (bytes(biomeName).length == 0) {
      biomeName = string(abi.encodePacked("Biome #", Strings.toString(biome)));
    }

    string[17] memory parts;

    parts[
      0
    ] = '<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" viewBox="0 0 350 350"><style>.base { fill: white; font-family: serif; font-size: 14px; }</style><rect width="100%" height="100%" fill="black" /><text x="10" y="20" class="base">';

    parts[1] = "Dark Forest Punk";

    parts[2] = '</text><text x="10" y="40" class="base">';

    parts[3] = "Dark Forest community rounds";

    parts[4] = '</text><text x="10" y="60" class="base">';

    parts[5] = "built on zkSNARKs &amp; MUD engine";

    parts[6] = '</text><text x="10" y="80" class="base">';

    parts[7] = "Onchain Reality Universe Artifacts";

    parts[8] = '</text><text x="10" y="100" class="base">';

    parts[9] = string(abi.encodePacked("Artifact #", Strings.toHexString(tokenId)));

    parts[10] = '</text><text x="10" y="120" class="base">';

    parts[11] = artifactType;

    parts[12] = '</text><text x="10" y="140" class="base">';

    parts[13] = artifactRarity;

    parts[14] = '</text><text x="10" y="160" class="base">';

    parts[15] = biomeName;

    parts[16] = "</text></svg>";

    string memory output = string(
      abi.encodePacked(parts[0], parts[1], parts[2], parts[3], parts[4], parts[5], parts[6], parts[7], parts[8])
    );
    output = string(
      abi.encodePacked(output, parts[9], parts[10], parts[11], parts[12], parts[13], parts[14], parts[15], parts[16])
    );

    string memory json = Base64.encode(
      bytes(
        string(
          abi.encodePacked(
            '{"name": "Artifact #',
            Strings.toHexString(tokenId),
            '", "description": "The artifacts are gifts from Dark Forest Punk universe.", "image": "data:image/svg+xml;base64,',
            Base64.encode(bytes(output)),
            '"}'
          )
        )
      )
    );
    output = string(abi.encodePacked("data:application/json;base64,", json));

    return output;
  }
}
