// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { StoreSwitch } from "@latticexyz/store/src/StoreSwitch.sol";
import { stdToml } from "forge-std/StdToml.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { WorldResourceIdLib } from "@latticexyz/world/src/WorldResourceId.sol";

import { IWorld } from "../src/codegen/world/IWorld.sol";
import { WorldResourceIdLib } from "@latticexyz/world/src/WorldResourceId.sol";
import { RESOURCE_SYSTEM } from "@latticexyz/world/src/worldResourceTypes.sol";
import { ResourceId } from "@latticexyz/store/src/ResourceId.sol";
import { Systems } from "@latticexyz/world/src/codegen/tables/Systems.sol";
import { SpaceType, PlanetType, ArtifactRarity, PlanetStatus } from "../src/codegen/common.sol";
import { PlanetMetadata, PlanetMetadataData, Planet, PlanetData, PlanetOwner, PlanetConstants } from "../src/codegen/index.sol";
import { PlanetInitialResource, PlanetInitialResourceData } from "../src/codegen/index.sol";
import { UniverseConfig, UniverseConfigData, TempConfigSet, TempConfigSetData } from "../src/codegen/index.sol";
import { SpaceTypeConfig, SpaceTypeConfigData } from "../src/codegen/index.sol";
import { UniverseZoneConfig, UniverseZoneConfigData } from "../src/codegen/index.sol";
import { PlanetLevelConfig, PlanetTypeConfig } from "../src/codegen/index.sol";
import { SnarkConfig, SnarkConfigData, Ticker } from "../src/codegen/index.sol";
import { InnerCircle, InnerCircleData } from "../src/codegen/index.sol";
import { UpgradeConfig, UpgradeConfigData } from "../src/codegen/index.sol";
import { GuildConfig, GuildConfigData } from "../src/codegen/index.sol";
import { Round } from "../src/codegen/index.sol";
import { ArtifactNFT as ArtifactNFTTable } from "../src/codegen/index.sol";
import { AtfInstallModule } from "../src/codegen/index.sol";
import { RevealedPlanet, PlanetBiomeConfig, PlanetBiomeConfigData, ArtifactConfig } from "../src/codegen/index.sol";
import { JunkConfig, JunkConfigData } from "../src/codegen/index.sol";
import { ArtifactInstallModule } from "../src/modules/atfs/ArtifactInstallModule.sol";
import { installCannon } from "../src/modules/atfs/PhotoidCannon/CannonInstallLibrary.sol";
import { installWormhole } from "../src/modules/atfs/Wormhole/WormholeInstallLibrary.sol";
import { installBloomFilter } from "../src/modules/atfs/BloomFilter/BloomFilterInstallLibrary.sol";
import { installPinkBomb } from "../src/modules/atfs/PinkBomb/PinkBombInstallLibrary.sol";
import { installSpaceshipDefense } from "../src/modules/atfs/SpaceshipDefense/SpaceshipDefenseInstallLibrary.sol";
import { IArtifactNFT } from "../src/tokens/IArtifactNFT.sol";
import { ArtifactNFT } from "../src/tokens/ArtifactNFT.sol";
import { MaterialToken as MaterialTokenTable } from "../src/codegen/index.sol";
import { MaterialToken } from "../src/tokens/MaterialToken.sol";
import { TokenDeploymentHelper } from "../src/systems/TokenDeploymentHelper.sol";
import { PlanetToken as PlanetTokenTable } from "../src/codegen/index.sol";
import { PlanetToken } from "../src/tokens/PlanetToken.sol";
import { EntryFee } from "codegen/tables/EntryFee.sol";

contract PostDeploy is Script {
  using stdToml for string;
  using Strings for uint256;

  function run(address worldAddress) external {
    // Specify a store so that you can use tables directly in PostDeploy
    StoreSwitch.setStoreAddress(worldAddress);

    // Load the private key from the `PRIVATE_KEY` environment variable (in .env)
    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

    // Start broadcasting transactions from the deployer account
    vm.startBroadcast(deployerPrivateKey);

    // Set planet metadata
    _setPlanetMetadata(worldAddress);

    // configure the universe
    string memory tomlPath = "df.config.toml";
    string memory toml = vm.readFile(tomlPath);
    uint8 roundNum = _configureUniverse(toml);

    // Deploy and configure tokens
    _deployAndConfigureTokens(toml, deployerPrivateKey, worldAddress, roundNum);

    // set entry fee
    uint256 entryFee = toml.readUint(".entry_fee.value");
    if (entryFee > 0) EntryFee.set(entryFee);

    // deploy artifact install module
    ArtifactInstallModule artifactInstallModule = new ArtifactInstallModule();
    AtfInstallModule.set(address(artifactInstallModule));

    // install artifacts
    _installArtifacts(worldAddress);

    // set test planets
    if (toml.readBool(".test.set_planets")) {
      if (toml.readBool(".temp.b_skip_proof_check")) {
        _setTestPlanets(abi.decode(toml.parseRaw(".test_planets_fake"), (TestPlanet[])));
      } else {
        _setTestPlanets(abi.decode(toml.parseRaw(".test_planets"), (TestPlanet[])));
      }
    }

    // register fallback delegation of df namespace
    IWorld(worldAddress).registerNamespaceDelegation(
      WorldResourceIdLib.encodeNamespace("df"),
      WorldResourceIdLib.encode("sy", "df", "DfDelegationCtrl"),
      new bytes(0)
    );

    vm.stopBroadcast();
  }

  function _configureUniverse(string memory toml) internal returns (uint8 roundNum) {
    UniverseConfig.set(abi.decode(toml.parseRaw(".universe"), (UniverseConfigData)));
    TempConfigSet.set(abi.decode(toml.parseRaw(".temp"), (TempConfigSetData)));
    SpaceTypeConfig.set(abi.decode(toml.parseRaw(".space_type"), (SpaceTypeConfigData)));
    UniverseZoneConfig.set(abi.decode(toml.parseRaw(".universe_zone"), (UniverseZoneConfigData)));
    PlanetLevelConfig.set(abi.decode(toml.parseRaw(".planet_level.thresholds"), (uint32[])));
    PlanetBiomeConfig.set(abi.decode(toml.parseRaw(".planet_biome"), (PlanetBiomeConfigData)));
    for (uint256 i = 1; i <= uint8(type(SpaceType).max); i++) {
      for (uint256 j; j <= PlanetLevelConfig.length(); j++) {
        string memory key = string.concat(".planet_type.thresholds.", i.toString(), ".", j.toString());
        PlanetTypeConfig.set(SpaceType(uint8(i)), uint8(j), abi.decode(toml.parseRaw(key), (uint16[])));
      }
    }
    SnarkConfig.set(abi.decode(toml.parseRaw(".snark"), (SnarkConfigData)));
    Ticker.set(0, uint64(toml.readUint(".ticker.rate")), 0, true);
    InnerCircle.set(abi.decode(toml.parseRaw(".inner_circle"), (InnerCircleData)));
    UpgradeConfig.set(abi.decode(toml.parseRaw(".upgrade_config"), (UpgradeConfigData)));
    GuildConfig.set(abi.decode(toml.parseRaw(".guild_config"), (GuildConfigData)));
    uint8[] memory indexes = abi.decode(toml.parseRaw(".artifact.indexes"), (uint8[]));
    for (uint256 i = 1; i <= uint8(type(ArtifactRarity).max); i++) {
      string memory key = string.concat(".artifact.", i.toString());
      ArtifactConfig.set(ArtifactRarity(i), indexes, abi.decode(toml.parseRaw(key), (uint16[])));
    }
    JunkConfig.set(abi.decode(toml.parseRaw(".junk_config"), (JunkConfigData)));
    roundNum = abi.decode(toml.parseRaw(".round.number"), (uint8));
    Round.set(roundNum);
  }

  function _deployAndConfigureTokens(
    string memory toml,
    uint256 deployerPrivateKey,
    address worldAddress,
    uint8 roundNum
  ) internal {
    address royaltyRecipient = toml.keyExists(".royalty_recipient")
      ? toml.readAddress(".royalty_recipient")
      : vm.addr(deployerPrivateKey);

    console.log("Royalty recipient address:", royaltyRecipient);

    TokenDeploymentHelper.DeploymentResult memory tokenResult = TokenDeploymentHelper.deployOrReuseTokens(
      toml.keyExists(".artifact_nft.address") ? toml.readAddress(".artifact_nft.address") : address(0),
      toml.keyExists(".material_token.address") ? toml.readAddress(".material_token.address") : address(0),
      royaltyRecipient,
      vm.addr(deployerPrivateKey)
    );

    ArtifactNFTTable.set(tokenResult.artifactNFTAddress);
    MaterialTokenTable.set(tokenResult.materialTokenAddress);

    if (!tokenResult.artifactNFTReused) {
      _setArtifactNFTConfig(tokenResult.artifactNFTAddress);
    }

    if (toml.readBool(".artifact_nft.set_current_round")) {
      IArtifactNFT(tokenResult.artifactNFTAddress).setDF(roundNum, worldAddress);
    }

    _configureTokenRoyaltiesAndMinter(tokenResult.materialTokenAddress, worldAddress);

    // Deploy or reuse PlanetToken (ERC721)
    address planetTokenAddress;
    bool planetTokenReused = false;
    if (toml.keyExists(".planet_token.address")) {
      planetTokenAddress = toml.readAddress(".planet_token.address");
      // Verify it's a valid PlanetToken contract by checking if it has the mint function
      // For simplicity, we'll just check if address is not zero
      if (planetTokenAddress != address(0)) {
        planetTokenReused = true;
        console.log("Reusing existing PlanetToken at:", planetTokenAddress);
      }
    }

    if (planetTokenAddress == address(0)) {
      PlanetToken planetToken = new PlanetToken();
      planetTokenAddress = address(planetToken);
      console.log("Deployed new PlanetToken at:", planetTokenAddress);

      // Set royalty recipient to world address
      planetToken.setRoyaltyRecipient(worldAddress);
      console.log("PlanetToken royalty recipient set to world address:", worldAddress);
    } else {
      // If reusing, still set royalty recipient (in case it wasn't set before)
      PlanetToken planetToken = PlanetToken(planetTokenAddress);
      try planetToken.setRoyaltyRecipient(worldAddress) {
        console.log("PlanetToken royalty recipient set to world address:", worldAddress);
      } catch {
        console.log("Note: Could not set PlanetToken royalty recipient (may already be set or not owner)");
      }
    }

    // Store PlanetToken address in MUD table
    PlanetTokenTable.set(planetTokenAddress);

    // Mint initial PlanetTokens for testing/deployment (only if we deployed new token or have permissions)
    PlanetToken planetTokenContract = PlanetToken(planetTokenAddress);
    address deployerAddress = vm.addr(deployerPrivateKey);

    // Try to grant minter permissions to deployer (for initial minting)
    // This will only work if deployer is the owner of the PlanetToken contract
    try planetTokenContract.setMinter(deployerAddress, true) {
      console.log("Granted minter permissions to deployer:", deployerAddress);

      // Mint 1 PlanetToken NFT with level 7 and PlanetType.PLANET
      uint256 tokenId1 = planetTokenContract.mint(deployerAddress, 7, PlanetType.PLANET);
      console.log("Minted 1 PlanetToken NFT (level 7, type PLANET) to deployer with tokenId:", tokenId1);

      // Mint 1 PlanetToken NFT with level 9 and PlanetType.STARBASE
      uint256 tokenId2 = planetTokenContract.mint(deployerAddress, 9, PlanetType.STARBASE);
      console.log("Minted 1 PlanetToken NFT (level 9, type STARBASE) to deployer with tokenId:", tokenId2);
    } catch {
      console.log("Note: Could not grant minter permissions or mint tokens (deployer may not be PlanetToken owner)");
      console.log("If reusing existing PlanetToken, ensure deployer has minter permissions or mint manually");
    }

    console.log("ArtifactNFT Address:", tokenResult.artifactNFTAddress);
    console.log("MaterialToken Address:", tokenResult.materialTokenAddress);
    console.log("PlanetToken Address:", planetTokenAddress);
    console.log("ArtifactNFT Reused:", tokenResult.artifactNFTReused);
    console.log("MaterialToken Reused:", tokenResult.materialTokenReused);
    console.log("PlanetToken Reused:", planetTokenReused);
    console.log("");
    console.log("");
    console.log("========================================");
    console.log("TOKEN ADDRESSES FOR FUTURE ROUNDS:");
    console.log("========================================");
    console.log("ArtifactNFT:", tokenResult.artifactNFTAddress);
    console.log("MaterialToken:", tokenResult.materialTokenAddress);
    console.log("PlanetToken:", planetTokenAddress);
    console.log("========================================");
    console.log("");
    console.log("Add these addresses to df.config.toml for future rounds:");
    console.log("");
    console.log("[artifact_nft]");
    console.log('address = "', tokenResult.artifactNFTAddress, '"');
    console.log("");
    console.log("[material_token]");
    console.log('address = "', tokenResult.materialTokenAddress, '"');
    console.log("");
    console.log("[planet_token]");
    console.log('address = "', planetTokenAddress, '"');
    console.log("");
    console.log("========================================");
  }

  function _configureTokenRoyaltiesAndMinter(address materialTokenAddress, address worldAddress) internal {
    ArtifactNFT artifactNFT = ArtifactNFT(ArtifactNFTTable.get());
    MaterialToken materialToken = MaterialToken(materialTokenAddress);

    artifactNFT.setRoyaltyRecipient(worldAddress);
    materialToken.setRoyaltyRecipient(worldAddress);

    console.log("Royalty recipient set to world address:", worldAddress);
    console.log("Note: World contract can receive ETH royalties and withdraw via transferBalanceToAddress");

    // Try to register WithdrawMaterialSystem as a minter
    // System name must be truncated to 16 bytes: "WithdrawMaterial" = 16 chars
    bytes16 withdrawMaterialSystemName = "WithdrawMaterial";
    ResourceId withdrawMaterialSystemId = WorldResourceIdLib.encode({
      typeId: RESOURCE_SYSTEM,
      namespace: "df",
      name: withdrawMaterialSystemName
    });

    address withdrawMaterialSystemAddress = Systems.getSystem(withdrawMaterialSystemId);
    if (withdrawMaterialSystemAddress != address(0)) {
      // Use addMinter directly since we've already validated the system exists via Systems.getSystem()
      // addSystemMinter requires SystemRegistry access which MaterialToken doesn't have
      materialToken.addMinter(withdrawMaterialSystemAddress);
      console.log("WithdrawMaterialSystem registered as minter:", withdrawMaterialSystemAddress);
    } else {
      console.log("Warning: WithdrawMaterialSystem not found, skipping minter registration");
      console.log("Note: System may need to be registered manually after deployment");
    }

    // Pre-compute and store all token URIs to avoid generating them on-the-fly during minting
    // This sets the URI for all material tokens (0-12) using auto-generated metadata
    console.log("Setting all material token URIs...");
    try materialToken.setAllTokenURI() {
      console.log("All material token URIs have been set successfully");
    } catch Error(string memory reason) {
      console.log("Error setting token URIs:", reason);
      // Don't revert - allow deployment to continue even if URI generation fails
      // URIs can be set manually later if needed
    } catch (bytes memory lowLevelData) {
      console.log("Low-level error setting token URIs");
      // Log the error but don't revert deployment
    }
  }

  function _setPlanetMetadata(address worldAddress) internal {
    console.log("Setting planet metadata");
    IWorld(worldAddress).df__setPlanetMetadata(
      0,
      PlanetMetadataData(99, 160, 400, 100000, 417, 0, 0), // range, speed, defense, populationCap, populationGrowth, silverCap, silverGrowth
      0 // initialPopulationPercentage
    );

    IWorld(worldAddress).df__setPlanetMetadata(1, PlanetMetadataData(177, 160, 400, 400000, 833, 100000, 56), 1);
    IWorld(worldAddress).df__setPlanetMetadata(2, PlanetMetadataData(315, 160, 300, 1600000, 1250, 500000, 167), 2);
    IWorld(worldAddress).df__setPlanetMetadata(3, PlanetMetadataData(591, 160, 300, 6000000, 1667, 2500000, 417), 3);
    IWorld(worldAddress).df__setPlanetMetadata(4, PlanetMetadataData(1025, 160, 300, 25000000, 2083, 12000000, 833), 4);
    IWorld(worldAddress).df__setPlanetMetadata(
      5,
      PlanetMetadataData(1734, 160, 200, 100000000, 2500, 50000000, 1667),
      5
    );
    IWorld(worldAddress).df__setPlanetMetadata(
      6,
      PlanetMetadataData(2838, 160, 200, 300000000, 2917, 100000000, 2778),
      7
    );
    IWorld(worldAddress).df__setPlanetMetadata(
      7,
      PlanetMetadataData(4414, 160, 200, 500000000, 3333, 200000000, 2778),
      10
    );
    IWorld(worldAddress).df__setPlanetMetadata(
      8,
      PlanetMetadataData(6306, 160, 200, 700000000, 3750, 300000000, 2778),
      20
    );
    IWorld(worldAddress).df__setPlanetMetadata(
      9,
      PlanetMetadataData(8829, 160, 200, 800000000, 4167, 400000000, 2778),
      25
    );
  }

  struct TestPlanet {
    int32 x;
    int32 y;
    bytes32 planetHash;
    address owner;
    uint64 lastUpdateTick;
    uint8 perlin;
    uint8 level;
    PlanetType planetType;
    SpaceType spaceType;
    uint64 population;
    uint64 silver;
    uint24 upgrades;
  }

  function _setTestPlanets(TestPlanet[] memory planets) internal {
    console.log("Dropping test planets");
    for (uint256 i; i < planets.length; i++) {
      PlanetConstants.set(
        planets[i].planetHash,
        planets[i].perlin,
        planets[i].level,
        planets[i].planetType,
        planets[i].spaceType
      );
      Planet.set(
        planets[i].planetHash,
        planets[i].lastUpdateTick,
        planets[i].population,
        planets[i].silver,
        planets[i].upgrades,
        false
      );
      PlanetOwner.set(planets[i].planetHash, planets[i].owner);
      RevealedPlanet.set(planets[i].planetHash, planets[i].x, planets[i].y, planets[i].owner);
    }
  }

  function _installArtifacts(address worldAddress) internal {
    console.log("Installing artifacts");
    uint256 index = installCannon(worldAddress);
    console.log("Installed cannon with index", index);
    index = installWormhole(worldAddress);
    console.log("Installed wormhole with index", index);
    index = installBloomFilter(worldAddress);
    console.log("Installed bloom filter with index", index);
    index = installPinkBomb(worldAddress);
    console.log("Installed pinkbomb with index", index);
    index = installSpaceshipDefense(worldAddress);
    console.log("Installed spaceship defense with index", index);
  }

  function _setArtifactNFTConfig(address artifactNftAddress) internal {
    require(artifactNftAddress != address(0), "artifactNftAddress is not set");
    ArtifactNFT nft = ArtifactNFT(artifactNftAddress);
    // Set artifact type names for all installed artifacts
    // Index mapping: SpaceshipDefense=3, PinkBomb=1, BloomFilter=4, Wormhole=5, PhotoidCannon=6
    uint8[] memory artifactTypeIndexes = new uint8[](5);
    string[] memory artifactTypeNames = new string[](5);

    artifactTypeIndexes[0] = 6;
    artifactTypeNames[0] = "Photoid Cannon";

    artifactTypeIndexes[1] = 5;
    artifactTypeNames[1] = "Wormhole";

    artifactTypeIndexes[2] = 4;
    artifactTypeNames[2] = "Bloom Filter";

    artifactTypeIndexes[3] = 3;
    artifactTypeNames[3] = "Spaceship Defense";

    artifactTypeIndexes[4] = 1;
    artifactTypeNames[4] = "Pink Bomb";

    nft.bulkSetArtifactTypeNames(artifactTypeIndexes, artifactTypeNames);

    uint8[] memory artifactRarityIndexes = new uint8[](5);
    string[] memory artifactRarityNames = new string[](5);

    artifactRarityIndexes[0] = 1;
    artifactRarityNames[0] = "COMMON";

    artifactRarityIndexes[1] = 2;
    artifactRarityNames[1] = "RARE";

    artifactRarityIndexes[2] = 3;
    artifactRarityNames[2] = "EPIC";

    artifactRarityIndexes[3] = 4;
    artifactRarityNames[3] = "LEGENDARY";

    artifactRarityIndexes[4] = 5;
    artifactRarityNames[4] = "MYTHIC";

    nft.bulkSetArtifactRarityNames(artifactRarityIndexes, artifactRarityNames);

    uint8[] memory biomeIndexes = new uint8[](10);
    string[] memory biomeNames = new string[](10);

    biomeIndexes[0] = 1;
    biomeNames[0] = "OCEAN";

    biomeIndexes[1] = 2;
    biomeNames[1] = "FOREST";

    biomeIndexes[2] = 3;
    biomeNames[2] = "GRASSLAND";

    biomeIndexes[3] = 4;
    biomeNames[3] = "TUNDRA";

    biomeIndexes[4] = 5;
    biomeNames[4] = "SWAMP";

    biomeIndexes[5] = 6;
    biomeNames[5] = "DESERT";

    biomeIndexes[6] = 7;
    biomeNames[6] = "ICE";

    biomeIndexes[7] = 8;
    biomeNames[7] = "WASTELAND";

    biomeIndexes[8] = 9;
    biomeNames[8] = "LAVA";

    biomeIndexes[9] = 10;
    biomeNames[9] = "CORRUPTED";

    nft.bulkSetBiomeNames(biomeIndexes, biomeNames);
  }
}
