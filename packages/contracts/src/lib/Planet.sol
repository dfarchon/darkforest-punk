// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { IBaseWorld } from "@latticexyz/world/src/codegen/interfaces/IBaseWorld.sol";
import { Errors } from "interfaces/errors.sol";
import { PlanetType, SpaceType, Biome, ArtifactStatus, PlanetStatus, PlanetFlagType, ArtifactGenre, MaterialType } from "codegen/common.sol";
import { Planet as PlanetTable, PlanetData } from "codegen/tables/Planet.sol";
import { PlanetMetadata, PlanetMetadataData } from "codegen/tables/PlanetMetadata.sol";
import { PlanetOwner } from "codegen/tables/PlanetOwner.sol";
import { PlanetJunkOwner } from "codegen/tables/PlanetJunkOwner.sol";
import { PlanetAddJunkTick } from "codegen/tables/PlanetAddJunkTick.sol";
import { PlanetConstants, PlanetConstantsData } from "codegen/tables/PlanetConstants.sol";
import { PlanetProps, PlanetPropsData } from "codegen/tables/PlanetProps.sol";
import { PlanetEffects, PlanetEffectsData } from "codegen/tables/PlanetEffects.sol";
import { UniverseConfig } from "codegen/tables/UniverseConfig.sol";
import { UniverseZoneConfig } from "codegen/tables/UniverseZoneConfig.sol";
import { PlanetLevelConfig } from "codegen/tables/PlanetLevelConfig.sol";
import { SpaceTypeConfig } from "codegen/tables/SpaceTypeConfig.sol";
import { PlanetTypeConfig } from "codegen/tables/PlanetTypeConfig.sol";
import { PlanetInitialResource, PlanetInitialResourceData } from "codegen/tables/PlanetInitialResource.sol";
import { Ticker } from "codegen/tables/Ticker.sol";
import { PendingMoveData } from "codegen/tables/PendingMove.sol";
import { MoveData } from "codegen/tables/Move.sol";
import { UpgradeConfig, UpgradeConfigData } from "codegen/tables/UpgradeConfig.sol";
import { ProspectedPlanet } from "codegen/tables/ProspectedPlanet.sol";
import { PlanetBiomeConfig, PlanetBiomeConfigData } from "codegen/tables/PlanetBiomeConfig.sol";
import { PlanetFlags } from "codegen/tables/PlanetFlags.sol";
import { ArtifactMetadataData } from "modules/atfs/tables/ArtifactMetadata.sol";
import { ABDKMath64x64 } from "abdk-libraries-solidity/ABDKMath64x64.sol";
import { PendingMoveQueue } from "libraries/Move.sol";
import { Artifact, ArtifactLib, ArtifactStorage, ArtifactStorageLib } from "libraries/Artifact.sol";
import { MaterialStorage } from "libraries/Material.sol";
import { Effect, EffectLib } from "libraries/Effect.sol";

import { _artifactProxySystemId, _artifactIndexToNamespace } from "modules/atfs/utils.sol";
import { IArtifactProxySystem } from "modules/atfs/IArtifactProxySystem.sol";
import { Flags, FlagsLib } from "libraries/Flags.sol";

using PlanetLib for Planet global;

struct Planet {
  uint256 planetHash;
  uint256 distSquare; // only for toPlanet in a move
  uint256 universeZone; // only for newly initialized toPlanet in a move
  PlanetStatus status; // derived from flags
  // Table: PlanetOwner
  bool ownerChanged;
  address owner;
  address junkOwner;
  uint256 addJunkTick;
  // Table: PlanetConstants
  bool isInitializing;
  uint256 perlin;
  uint256 level;
  PlanetType planetType;
  SpaceType spaceType;
  // Table: Planet
  uint256 lastUpdateTick;
  uint256 population;
  uint256 silver;
  uint256 rangeUpgrades;
  uint256 speedUpgrades;
  uint256 defenseUpgrades;
  bool useProps;
  // Table: PlanetProps / PlanetMetadata
  bool updateProps;
  uint256 range;
  uint256 speed;
  uint256 defense;
  uint256 populationCap;
  uint256 populationGrowth;
  uint256 silverCap;
  uint256 silverGrowth;
  // move queue
  PendingMoveQueue moveQueue;
  // artifact storage
  ArtifactStorage artifactStorage;
  // effects
  uint256 effectNumber;
  Effect[] effects;
  // flags
  Flags flags;
  // Table: MaterialStorage
  MaterialStorage materialStorage;
}

library PlanetLib {
  function readFromStore(Planet memory planet) internal view {
    if (PlanetConstants.getPlanetType(bytes32(planet.planetHash)) == PlanetType.UNKNOWN) {
      _validateHash(planet);
      _initPlanet(planet);
    } else {
      _readPlanetData(planet);
      _readConstants(planet);
      _readEffects(planet);
    }

    planet.artifactStorage.ReadFromStore(planet.planetHash);
    planet.moveQueue.ReadFromStore(planet.planetHash);

    _readPropsOrMetadata(planet);
    planet.flags = Flags.wrap(PlanetFlags.get(bytes32(planet.planetHash)));
    planet.status = FlagsLib.check(planet.flags, PlanetFlagType.DESTROYED)
      ? PlanetStatus.DESTROYED
      : PlanetStatus.DEFAULT;

    planet.materialStorage.ReadFromStore(planet.planetHash);
  }

  function writeToStore(Planet memory planet) internal {
    if (planet.isInitializing) {
      PlanetConstants.set(
        bytes32(planet.planetHash),
        PlanetConstantsData({
          perlin: uint8(planet.perlin),
          level: uint8(planet.level),
          planetType: planet.planetType,
          spaceType: planet.spaceType
        })
      );
    }
    if (planet.ownerChanged) {
      PlanetOwner.set(bytes32(planet.planetHash), planet.owner);
    }

    PlanetJunkOwner.set(bytes32(planet.planetHash), planet.junkOwner);
    PlanetAddJunkTick.set(bytes32(planet.planetHash), planet.addJunkTick);

    if (planet.updateProps) {
      planet.useProps = true;
      PlanetProps.set(
        bytes32(planet.planetHash),
        PlanetPropsData({
          range: uint32(planet.range),
          speed: uint16(planet.speed),
          defense: uint16(planet.defense),
          populationCap: uint64(planet.populationCap),
          populationGrowth: uint32(planet.populationGrowth),
          silverCap: uint64(planet.silverCap),
          silverGrowth: uint32(planet.silverGrowth)
        })
      );
    }
    planet.moveQueue.WriteToStore();
    planet.artifactStorage.WriteToStore();

    uint256 effectsData;
    for (uint256 i; i < planet.effectNumber; ) {
      effectsData <<= 24;
      effectsData += uint24(planet.effects[i].id);
      unchecked {
        ++i;
      }
    }
    if (effectsData != PlanetEffects.getEffects(bytes32(planet.planetHash))) {
      PlanetEffects.set(
        bytes32(planet.planetHash),
        PlanetEffectsData(uint8(planet.effectNumber), uint248(effectsData))
      );
    }

    if (Flags.unwrap(planet.flags) != PlanetFlags.get(bytes32(planet.planetHash))) {
      PlanetFlags.set(bytes32(planet.planetHash), Flags.unwrap(planet.flags));
    }

    PlanetTable.set(
      bytes32(planet.planetHash),
      PlanetData({
        lastUpdateTick: uint64(planet.lastUpdateTick),
        population: uint64(planet.population),
        silver: uint64(planet.silver),
        upgrades: uint24((planet.rangeUpgrades << 16) | (planet.speedUpgrades << 8) | planet.defenseUpgrades),
        useProps: planet.useProps
      })
    );

    // Write materials to storage
    planet.materialStorage.WriteToStore(planet.planetHash);
  }

  function naturalGrowth(Planet memory planet, uint256 untilTick) internal view {
    if (planet.lastUpdateTick >= untilTick) {
      return;
    }

    uint256 startTick = planet.addJunkTick > planet.lastUpdateTick ? planet.addJunkTick : planet.lastUpdateTick;
    uint256 tickElapsed = untilTick - startTick;

    planet.lastUpdateTick = untilTick;

    if (planet.owner == address(0)) {
      return;
    }

    if (planet.owner != planet.junkOwner) {
      return;
    }

    _populationGrow(planet, tickElapsed);
    _silverGrow(planet, tickElapsed);
    _materialGrow(planet, tickElapsed);
  }

  function pushMove(Planet memory planet, MoveData memory move) internal {
    planet.moveQueue.PushMove(move);
  }

  function popArrivedMove(Planet memory planet, uint256 untilTick) internal view returns (MoveData memory move) {
    return planet.moveQueue.PopArrivedMove(untilTick);
  }

  function hasArtifactSlot(Planet memory planet) internal view returns (bool) {
    return
      planet.artifactStorage.GetNumber() + planet.moveQueue.GetFlyingArtifactsNum() <
      ArtifactStorageLib.MAX_ARTIFACTS_PER_PLANET;
  }

  function pushArtifact(Planet memory planet, uint256 artifact) internal pure {
    planet.artifactStorage.Push(artifact);
  }

  function removeArtifact(Planet memory planet, uint256 artifact) internal pure {
    planet.artifactStorage.Remove(artifact);
  }

  function chargeArtifact(
    Planet memory planet,
    Artifact memory artifact,
    bytes memory inputData,
    address world
  ) internal returns (Planet memory, Artifact memory) {
    _validateChargeArtifact(planet, artifact);
    bytes memory data = IBaseWorld(world).call(
      _artifactProxySystemId(_artifactIndexToNamespace(artifact.artifactIndex)),
      abi.encodeCall(IArtifactProxySystem.charge, (planet, artifact, inputData))
    );
    return abi.decode(data, (Planet, Artifact));
  }

  function shutdownArtifact(
    Planet memory planet,
    Artifact memory artifact,
    address world
  ) internal returns (Planet memory, Artifact memory) {
    _validateShutdownArtifact(planet, artifact);
    bytes memory data = IBaseWorld(world).call(
      _artifactProxySystemId(_artifactIndexToNamespace(artifact.artifactIndex)),
      abi.encodeCall(IArtifactProxySystem.shutdown, (planet, artifact))
    );
    return abi.decode(data, (Planet, Artifact));
  }

  function activateArtifact(
    Planet memory planet,
    Artifact memory artifact,
    bytes memory inputData,
    address world
  ) internal returns (Planet memory, Artifact memory) {
    _validateActivateArtifact(planet, artifact);
    bytes memory data = IBaseWorld(world).call(
      _artifactProxySystemId(_artifactIndexToNamespace(artifact.artifactIndex)),
      abi.encodeCall(IArtifactProxySystem.activate, (planet, artifact, inputData))
    );
    return abi.decode(data, (Planet, Artifact));
  }

  // function deactivateArtifact(
  //   Planet memory planet,
  //   Artifact memory artifact,
  //   address world
  // ) internal returns (Planet memory, Artifact memory) {
  //   _validateDeactivateArtifact(planet, artifact);
  //   bytes memory data = IBaseWorld(world).call(
  //     _artifactProxySystemId(_artifactIndexToNamespace(artifact.artifactIndex)),
  //     abi.encodeCall(IArtifactProxySystem.deactivate, (planet, artifact))
  //   );
  //   return abi.decode(data, (Planet, Artifact));
  // }

  function changeOwner(Planet memory planet, address newOwner) internal pure {
    planet.owner = newOwner;
    planet.ownerChanged = true;
  }

  function upgrade(
    Planet memory planet,
    address executor,
    uint256 rangeUpgrades,
    uint256 speedUpgrades,
    uint256 defenseUpgrades
  ) internal view {
    _validateUpgrade(planet, executor, rangeUpgrades, speedUpgrades, defenseUpgrades);
    uint256 silverCost = _calUpgradeCost(planet, rangeUpgrades, speedUpgrades, defenseUpgrades);
    if (planet.silver < silverCost) {
      revert Errors.NotEnoughSilverToUpgrade();
    }
    planet.rangeUpgrades += rangeUpgrades;
    planet.speedUpgrades += speedUpgrades;
    planet.defenseUpgrades += defenseUpgrades;
    planet.silver -= silverCost;
    _activateUpgrades(planet, rangeUpgrades, speedUpgrades, defenseUpgrades);
  }

  function prospect(Planet memory planet, address executor) internal {
    _validateProspect(planet, executor);
    ProspectedPlanet.set(bytes32(planet.planetHash), uint64(block.number));
  }

  function findArtifact(
    Planet memory planet,
    address executor,
    uint256 biomebase
  ) internal view returns (Artifact memory artifact) {
    _validateFindingArtifact(planet, executor);
    artifact = ArtifactLib.NewArtifact(
      _createArtifactSeed(planet),
      planet.planetHash,
      planet.level,
      planet.spaceType,
      biomebase
    );
    if (planet.hasArtifactSlot()) {
      planet.pushArtifact(artifact.id);
    } else {
      revert Errors.ArtifactStorageFull();
    }
    setFlag(planet, PlanetFlagType.EXPLORED);
  }

  function mustGetArtifact(Planet memory planet, uint256 artifactId) internal view returns (Artifact memory artifact) {
    if (planet.artifactStorage.Has(artifactId)) {
      artifact.planetHash = planet.planetHash;
      artifact.id = artifactId;
      artifact.readFromStore(planet.lastUpdateTick);
    } else {
      revert Errors.ArtifactNotOnPlanet();
    }
  }

  function setFlag(Planet memory planet, PlanetFlagType flagType) internal pure {
    planet.flags = FlagsLib.set(planet.flags, flagType);
  }

  function unsetFlag(Planet memory planet, PlanetFlagType flagType) internal pure {
    planet.flags = FlagsLib.unset(planet.flags, flagType);
  }

  function checkFlag(Planet memory planet, PlanetFlagType flagType) internal pure returns (bool) {
    return FlagsLib.check(planet.flags, flagType);
  }

  function _validateHash(Planet memory planet) internal view {
    if (
      planet.planetHash >=
      (21888242871839275222246405745257275088548364400416034343698204186575808495617 / UniverseConfig.getSparsity())
    ) {
      revert Errors.InvalidPlanetHash();
    }
  }

  function _initPlanet(Planet memory planet) internal view {
    planet.isInitializing = true;
    _initZone(planet);
    _initSpaceType(planet);
    _initLevel(planet);
    _initPlanetType(planet);
    _initPopulationAndSilver(planet);
    // _initPlanetMaterials(planet);
    planet.lastUpdateTick = Ticker.getTickNumber();
  }

  function _initSpaceType(Planet memory planet) internal view {
    uint32[] memory thresholds = SpaceTypeConfig.getPerlinThresholds();
    uint256 perlin = planet.perlin;
    uint256 length = thresholds.length;
    // if a planet locates at the last second zone, its space type is NEBULA
    if (planet.universeZone + 1 == UniverseZoneConfig.lengthBorders()) {
      planet.spaceType = SpaceType.NEBULA;
      return;
    }
    for (uint256 i; i < length; ) {
      if (perlin < thresholds[i]) {
        planet.spaceType = SpaceType(i + 1);
        return;
      }
      unchecked {
        ++i;
      }
    }
    planet.spaceType = SpaceType(length + 1);
  }

  function _initZone(Planet memory planet) internal view {
    uint64[] memory borders = UniverseZoneConfig.getBorders();
    uint256 distanceSquare = planet.distSquare;
    uint256 maxZone = borders.length;
    for (uint256 i; i < maxZone; ) {
      if (distanceSquare < borders[i] ** 2) {
        planet.universeZone = i;
        return;
      }
      unchecked {
        ++i;
      }
    }
    planet.universeZone = maxZone;
  }

  function _initLevel(Planet memory planet) internal view {
    uint256 value = uint24(planet.planetHash);
    uint32[] memory thresholds = PlanetLevelConfig.getThresholds();
    uint256 maxLvl = thresholds.length;
    for (uint256 i; i < maxLvl; ) {
      if (value < thresholds[i]) {
        planet.level = maxLvl - i;
        break;
      }
      unchecked {
        ++i;
      }
    }
    _bounceAndBoundLevel(planet);
  }

  function _bounceAndBoundLevel(Planet memory planet) internal view {
    // bounce level
    int256 level = int256(planet.level) + SpaceTypeConfig.getPlanetLevelBonus()[uint8(planet.spaceType) - 1];
    level += UniverseZoneConfig.getPlanetLevelBonus()[uint8(planet.universeZone)];

    // bound level
    if (level < 0) {
      planet.level = 0;
      return;
    }
    uint256 posLevel = uint256(level);
    uint256 limit = SpaceTypeConfig.getPlanetLevelLimits()[uint8(planet.spaceType) - 1];
    if (posLevel > limit) {
      posLevel = limit;
    }
    limit = UniverseZoneConfig.getPlanetLevelLimits()[uint8(planet.universeZone)];
    if (posLevel > limit) {
      posLevel = limit;
    }
    planet.level = posLevel;
  }

  function _initPlanetType(Planet memory planet) internal view {
    uint256 value = uint8(planet.planetHash >> 24);
    uint16[] memory thresholds = PlanetTypeConfig.getThresholds(planet.spaceType, uint8(planet.level));
    uint256 length = thresholds.length;
    uint256 cumulativeThreshold;
    for (uint256 i; i < length; ) {
      cumulativeThreshold += thresholds[i];
      if (value < cumulativeThreshold) {
        planet.planetType = PlanetType(i + 1);
        return;
      }
      unchecked {
        ++i;
      }
    }
    revert Errors.UnknownPlanetType();
  }

  function _initPopulationAndSilver(Planet memory planet) internal view {
    PlanetInitialResourceData memory initialResources = PlanetInitialResource.get(
      planet.spaceType,
      planet.planetType,
      uint8(planet.level)
    );
    planet.population = initialResources.population;
    planet.silver = initialResources.silver;
  }

  function _readPlanetData(Planet memory planet) internal view {
    planet.owner = PlanetOwner.get(bytes32(planet.planetHash));
    planet.junkOwner = PlanetJunkOwner.get(bytes32(planet.planetHash));
    PlanetData memory data = PlanetTable.get(bytes32(planet.planetHash));
    planet.lastUpdateTick = data.lastUpdateTick;
    planet.addJunkTick = PlanetAddJunkTick.get(bytes32(planet.planetHash));
    planet.population = data.population;
    planet.silver = data.silver;
    uint256 upgrades = data.upgrades;
    planet.rangeUpgrades = uint8(upgrades >> 16);
    planet.speedUpgrades = uint8(upgrades >> 8);
    planet.defenseUpgrades = uint8(upgrades);
    planet.useProps = data.useProps;
  }

  function _readConstants(Planet memory planet) internal view {
    PlanetConstantsData memory constants = PlanetConstants.get(bytes32(planet.planetHash));
    planet.perlin = constants.perlin;
    planet.level = constants.level;
    planet.planetType = constants.planetType;
    planet.spaceType = constants.spaceType;
  }

  function _readEffects(Planet memory planet) internal view {
    PlanetEffectsData memory effectsData = PlanetEffects.get(bytes32(planet.planetHash));
    uint256 effectNum = effectsData.num;
    planet.effectNumber = effectNum;
    Effect[] memory effects = new Effect[](effectNum);
    uint256 effectsArray = effectsData.effects;
    for (uint256 i; i < effectNum; ) {
      effects[effectNum - 1 - i] = EffectLib.parseEffect(uint24(effectsArray));
      unchecked {
        effectsArray >>= 24;
        ++i;
      }
    }
    planet.effects = effects;
  }

  function _readPropsOrMetadata(Planet memory planet) internal view {
    if (planet.useProps) {
      _readProps(planet);
    } else {
      _readMetadata(planet);
      _luckilyDouble(planet);
      _activateUpgrades(planet, planet.rangeUpgrades, planet.speedUpgrades, planet.defenseUpgrades);
    }
  }

  function _readProps(Planet memory planet) internal view {
    PlanetPropsData memory props = PlanetProps.get(bytes32(planet.planetHash));
    planet.range = props.range;
    planet.speed = props.speed;
    planet.defense = props.defense;
    planet.populationCap = props.populationCap;
    planet.populationGrowth = props.populationGrowth;
    planet.silverCap = props.silverCap;
    planet.silverGrowth = props.silverGrowth;
  }

  function _readMetadata(Planet memory planet) internal view {
    PlanetMetadataData memory metadata = PlanetMetadata.get(planet.spaceType, planet.planetType, uint8(planet.level));
    planet.range = metadata.range;
    planet.speed = metadata.speed;
    planet.defense = metadata.defense;
    planet.populationCap = metadata.populationCap;
    planet.populationGrowth = metadata.populationGrowth;
    planet.silverCap = metadata.silverCap;
    planet.silverGrowth = metadata.silverGrowth;
  }

  function _luckilyDouble(Planet memory planet) internal pure {
    uint256 value = planet.planetHash >> 32;
    if (uint8(value) < 16) {
      planet.populationCap *= 2;
    }
    value >>= 8;
    if (uint8(value) < 16) {
      planet.populationGrowth *= 2;
    }
    value >>= 8;
    if (uint8(value) < 16) {
      planet.range *= 2;
    }
    value >>= 8;
    if (uint8(value) < 16) {
      planet.speed *= 2;
    }
    value >>= 8;
    if (uint8(value) < 16) {
      planet.defense *= 2;
    }
  }

  function _activateUpgrades(
    Planet memory planet,
    uint256 rangeUpgrades,
    uint256 speedUpgrades,
    uint256 defenseUpgrades
  ) internal view {
    uint256 totalLevel = rangeUpgrades + speedUpgrades + defenseUpgrades;
    if (totalLevel == 0) {
      return;
    }
    UpgradeConfigData memory config = UpgradeConfig.get();
    planet.populationCap =
      (planet.populationCap * uint256(config.populationCapMultiplier) ** totalLevel) /
      uint256(100) ** totalLevel;
    planet.populationGrowth =
      (planet.populationGrowth * uint256(config.populationGrowthMultiplier) ** totalLevel) /
      uint256(100) ** totalLevel;
    if (rangeUpgrades > 0) {
      planet.range = (planet.range * uint256(config.rangeMultiplier) ** rangeUpgrades) / uint256(100) ** rangeUpgrades;
    }
    if (speedUpgrades > 0) {
      planet.speed = (planet.speed * uint256(config.speedMultiplier) ** speedUpgrades) / uint256(100) ** speedUpgrades;
    }
    if (defenseUpgrades > 0) {
      planet.defense =
        (planet.defense * uint256(config.defenseMultiplier) ** defenseUpgrades) /
        uint256(100) ** defenseUpgrades;
    }
    planet.updateProps = true;
  }

  function _populationGrow(Planet memory planet, uint256 tickElapsed) internal pure {
    if (planet.populationGrowth == 0) {
      return;
    }
    int128 time = ABDKMath64x64.fromUInt(tickElapsed);
    int128 one = ABDKMath64x64.fromUInt(1);

    int128 denominator = ABDKMath64x64.add(
      ABDKMath64x64.mul(
        ABDKMath64x64.exp(
          ABDKMath64x64.div(
            ABDKMath64x64.mul(
              ABDKMath64x64.mul(ABDKMath64x64.fromInt(-4), ABDKMath64x64.fromUInt(planet.populationGrowth)),
              time
            ),
            ABDKMath64x64.fromUInt(planet.populationCap)
          )
        ),
        ABDKMath64x64.sub(
          ABDKMath64x64.div(ABDKMath64x64.fromUInt(planet.populationCap), ABDKMath64x64.fromUInt(planet.population)),
          one
        )
      ),
      one
    );

    planet.population = ABDKMath64x64.toUInt(
      ABDKMath64x64.div(ABDKMath64x64.fromUInt(planet.populationCap), denominator)
    );
  }

  function _silverGrow(Planet memory planet, uint256 tickElapsed) internal pure {
    uint256 silver = planet.silver;
    uint256 cap = planet.silverCap;
    if (planet.silverGrowth == 0 || silver >= cap) {
      return;
    }
    silver += planet.silverGrowth * tickElapsed;
    planet.silver = silver > cap ? cap : silver;
  }

  function _materialGrow(Planet memory planet, uint256 tickElapsed) internal view {
    if (planet.planetType != PlanetType.ASTEROID_FIELD) {
      return;
    }
    MaterialStorage memory materialsStorage = planet.materialStorage;
    for (uint256 i; i < materialsStorage.growth.length; i++) {
      // materialsStorage.growth[i] is true if the material is allowed to grow double check in Material.sol
      if (materialsStorage.growth[i]) {
        uint256 growthRate = getMaterialGrowth(planet, MaterialType(i));
        uint256 currentAmount = getMaterial(planet, MaterialType(i));
        uint256 newAmount = currentAmount + growthRate * tickElapsed;
        setMaterial(planet, MaterialType(i), newAmount);
      }
    }
  }

  function initMaterial(Planet memory planet, MaterialType materialId) internal view {
    PlanetInitialResourceData memory initialResources = PlanetInitialResource.get(
      planet.spaceType,
      planet.planetType,
      uint8(planet.level)
    );

    uint256 amount = getMaterial(planet, materialId) + initialResources.silver;
    uint256 cap = getMaterialCap(planet, materialId);
    if (amount > cap) {
      amount = cap;
    }
    planet.materialStorage.initMaterial(planet.planetHash, materialId, amount);
  }

  function getMaterial(Planet memory planet, MaterialType materialId) internal view returns (uint256) {
    return planet.materialStorage.getMaterial(planet.planetHash, materialId);
  }

  function setMaterial(Planet memory planet, MaterialType materialId, uint256 amount) internal pure {
    uint256 cap = getMaterialCap(planet, materialId);
    if (amount > cap) {
      amount = cap;
    }
    planet.materialStorage.setMaterial(planet.planetHash, materialId, amount);
  }

  function getMaterialCap(Planet memory planet, MaterialType materialId) internal pure returns (uint256) {
    return planet.silverCap;
  }
  // TODO PUNK TEST THIS possible move to DF.config.toml
  // growth rate is calculated based on the material type like in the client getDefaultMaterials PlanetUtils.ts line 695
  function getMaterialGrowth(Planet memory planet, MaterialType materialId) internal pure returns (uint256) {
    return planet.silverGrowth / (uint256(materialId) * 2);
  }

  function allowedMaterialsForBiome(Biome biome) internal pure returns (MaterialType[] memory) {
    if (biome == Biome.CORRUPTED) {
      MaterialType[] memory corruptedMats = new MaterialType[](2);
      corruptedMats[0] = MaterialType.BLACKALLOY;
      corruptedMats[1] = MaterialType.CORRUPTED_CRYSTAL;
      return corruptedMats;
    }

    MaterialType biomeMat;

    if (biome == Biome.OCEAN) {
      biomeMat = MaterialType.WATER_CRYSTALS;
    } else if (biome == Biome.FOREST) {
      biomeMat = MaterialType.LIVING_WOOD;
    } else if (biome == Biome.GRASSLAND) {
      biomeMat = MaterialType.WINDSTEEL;
    } else if (biome == Biome.TUNDRA) {
      biomeMat = MaterialType.AURORIUM;
    } else if (biome == Biome.SWAMP) {
      biomeMat = MaterialType.MYCELIUM;
    } else if (biome == Biome.DESERT) {
      biomeMat = MaterialType.SANDGLASS;
    } else if (biome == Biome.ICE) {
      biomeMat = MaterialType.CRYOSTONE;
    } else if (biome == Biome.WASTELAND) {
      biomeMat = MaterialType.SCRAPIUM;
    } else if (biome == Biome.LAVA) {
      biomeMat = MaterialType.PYROSTEEL;
    }
    MaterialType[] memory singleMats = new MaterialType[](1);
    singleMats[0] = biomeMat;
    return singleMats;
  }

  function _validateUpgrade(
    Planet memory planet,
    address executor,
    uint256 rangeUpgrades,
    uint256 speedUpgrades,
    uint256 defenseUpgrades
  ) internal view {
    if (planet.owner != executor) {
      revert Errors.NotPlanetOwner();
    }
    if (planet.planetType != PlanetType.PLANET || planet.level == 0) {
      revert Errors.InvalidUpgradeTarget();
    }

    uint256 rangeLvl = planet.rangeUpgrades + rangeUpgrades;
    uint256 speedLvl = planet.speedUpgrades + speedUpgrades;
    uint256 defenseLvl = planet.defenseUpgrades + defenseUpgrades;

    UpgradeConfigData memory config = UpgradeConfig.get();
    uint256 maxSingleLevel = config.maxSingleLevel;
    uint256 maxTotalLevel = uint8(config.maxTotalLevel >> ((uint8(planet.spaceType) - 1) * 8));

    if (
      rangeLvl + speedLvl + defenseLvl > maxTotalLevel ||
      rangeLvl > maxSingleLevel ||
      speedLvl > maxSingleLevel ||
      defenseLvl > maxSingleLevel
    ) {
      revert Errors.UpgradeExceedMaxLevel();
    }
  }

  function _calUpgradeCost(
    Planet memory planet,
    uint256 rangeUpgrades,
    uint256 speedUpgrades,
    uint256 defenseUpgrades
  ) internal view returns (uint256 cost) {
    uint256 totalLevel = planet.rangeUpgrades + planet.speedUpgrades + planet.defenseUpgrades;
    uint256 curTotalLevel = totalLevel + rangeUpgrades + speedUpgrades + defenseUpgrades;

    uint256 silverCost = UpgradeConfig.getSilverCost() >> (totalLevel * 8);
    for (uint256 i = totalLevel; i < curTotalLevel; ) {
      cost += uint8(silverCost);
      unchecked {
        silverCost >>= 8;
        ++i;
      }
    }
    cost = (cost * planet.silverCap) / 100;
  }

  function _validateProspect(Planet memory planet, address executor) internal view {
    if (planet.owner != executor) {
      revert Errors.NotPlanetOwner();
    }
    if (planet.planetType != PlanetType.FOUNDRY) {
      revert Errors.InvalidProspectTarget();
    }
    uint256 prospectedAt = ProspectedPlanet.get(bytes32(planet.planetHash));
    if (prospectedAt != 0 && prospectedAt + 256 >= block.number) {
      revert Errors.PlanetAlreadyProspected();
    }
    if (checkFlag(planet, PlanetFlagType.EXPLORED)) {
      revert Errors.PlanetAlreadyExplored();
    }
    // todo check whether the gear spaceship is on this planet
  }

  function _validateFindingArtifact(Planet memory planet, address executor) internal view {
    if (checkFlag(planet, PlanetFlagType.EXPLORED)) {
      revert Errors.PlanetAlreadyExplored();
    }
    if (planet.owner != executor) {
      revert Errors.NotPlanetOwner();
    }
    if (ProspectedPlanet.get(bytes32(planet.planetHash)) + 256 < block.number) {
      revert Errors.PlanetNotProspected();
    }
    // todo check whether the gear spaceship is on this planet
  }

  function _validateShutdownArtifact(Planet memory, Artifact memory artifact) internal pure {
    if (artifact.status < ArtifactStatus.CHARGING || artifact.status > ArtifactStatus.ACTIVE) {
      revert Errors.ArtifactNotAvailable();
    }
  }

  function _validateChargeArtifact(Planet memory planet, Artifact memory artifact) internal pure {
    if (
      artifact.reqLevel > 0 &&
      (planet.level < (artifact.reqLevel & 0xff) || planet.level >= (artifact.reqLevel & 0xff00) >> 8)
    ) {
      revert Errors.PlanetLevelMismatch();
    }
    if (artifact.status != ArtifactStatus.DEFAULT) {
      revert Errors.ArtifactNotAvailable();
    }
    if (artifact.charge == 0) {
      revert Errors.ArtifactNotChargeable();
    }
    if (artifact.genre == ArtifactGenre.OFFENSIVE && checkFlag(planet, PlanetFlagType.OFFENSIVE_ARTIFACT)) {
      revert Errors.ArtifactNotAvailable();
    }
    if (artifact.genre == ArtifactGenre.DEFENSIVE && checkFlag(planet, PlanetFlagType.DEFENSIVE_ARTIFACT)) {
      revert Errors.ArtifactNotAvailable();
    }
    if (artifact.genre == ArtifactGenre.PRODUCTIVE && checkFlag(planet, PlanetFlagType.PRODUCTIVE_ARTIFACT)) {
      revert Errors.ArtifactNotAvailable();
    }
  }

  function _validateActivateArtifact(Planet memory planet, Artifact memory artifact) internal pure {
    if (
      artifact.reqLevel > 0 &&
      (planet.level < (artifact.reqLevel & 0xff) || planet.level >= (artifact.reqLevel & 0xff00) >> 8)
    ) {
      revert Errors.PlanetLevelMismatch();
    }
    if (planet.population <= artifact.reqPopulation || planet.silver < artifact.reqSilver) {
      revert Errors.NotEnoughResourceToActivate();
    }
    if (artifact.status == ArtifactStatus.DEFAULT) {
      if (artifact.genre == ArtifactGenre.OFFENSIVE && checkFlag(planet, PlanetFlagType.OFFENSIVE_ARTIFACT)) {
        revert Errors.ArtifactNotAvailable();
      }
      if (artifact.genre == ArtifactGenre.DEFENSIVE && checkFlag(planet, PlanetFlagType.DEFENSIVE_ARTIFACT)) {
        revert Errors.ArtifactNotAvailable();
      }
      if (artifact.genre == ArtifactGenre.PRODUCTIVE && checkFlag(planet, PlanetFlagType.PRODUCTIVE_ARTIFACT)) {
        revert Errors.ArtifactNotAvailable();
      }
    }
    if (
      artifact.status == ArtifactStatus.READY || (artifact.status == ArtifactStatus.DEFAULT && artifact.charge == 0)
    ) {
      return;
    } else {
      revert Errors.ArtifactNotAvailable();
    }
  }

  function _createArtifactSeed(Planet memory planet) internal view returns (uint256 seed) {
    seed = uint256(
      keccak256(
        abi.encodePacked(
          planet.planetHash,
          block.timestamp,
          blockhash(ProspectedPlanet.get(bytes32(planet.planetHash)))
        )
      )
    );
  }

  function _getBiome(Planet memory planet, uint256 biomeBase) internal view returns (Biome biome) {
    if (planet.spaceType == SpaceType.DEAD_SPACE) {
      return Biome.CORRUPTED;
    }
    uint256 res = uint8(planet.spaceType) * 3;
    PlanetBiomeConfigData memory config = PlanetBiomeConfig.get();
    if (biomeBase < config.threshold1) {
      res -= 2;
    } else if (biomeBase < config.threshold2) {
      res -= 1;
    }
    biome = res > uint8(type(Biome).max) ? type(Biome).max : Biome(res);
  }
}
