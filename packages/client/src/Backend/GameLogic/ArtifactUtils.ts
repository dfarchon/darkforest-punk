import { EMPTY_ADDRESS } from "@df/constants";
import { TxCollection } from "@df/network";
import {
  address,
  artifactIdFromDecStr,
  artifactIdToDecStr,
  locationIdFromHexStr,
  locationIdToHexStr,
} from "@df/serde";
import type {
  Artifact,
  // ArtifactStatus,
  // ArtifactType,
  ArtifactGenre,
  ArtifactId,
  ArtifactRarity,
  Biome,
  EthAddress,
  LocationId,
  Upgrade,
} from "@df/types";
import { ArtifactStatus, ArtifactType } from "@df/types";
import { getComponentValue } from "@latticexyz/recs";
import { encodeEntity } from "@latticexyz/store-sync/recs";
import type { ClientComponents } from "@mud/createClientComponents";

import type { ContractConstants } from "../../_types/darkforest/api/ContractsAPITypes";

interface ArtifactUtilsConfig {
  components: ClientComponents;
  contractConstants: ContractConstants;
}

export class ArtifactUtils {
  private components: ClientComponents;
  private contractConstants: ContractConstants;

  public constructor({ components, contractConstants }: ArtifactUtilsConfig) {
    this.components = components;
    this.contractConstants = contractConstants;
  }

  public getArtifactById(artifactId: ArtifactId): Artifact | undefined {
    const {
      Artifact,
      ArtifactOwner,
      PlanetOwner,
      PlanetConstants,
      PinkBombMetadata,
      BloomFilterMetadata,
      WormholeMetadata,
      CannonMetadata,
      CraftedSpaceship,
    } = this.components;

    const artifactEntity = encodeEntity(Artifact.metadata.keySchema, {
      id: Number(artifactIdToDecStr(artifactId)),
    });
    const artifactRec = getComponentValue(Artifact, artifactEntity);

    if (!artifactRec) {
      return undefined;
    }

    let planetId: LocationId = "0" as LocationId;
    let owner: EthAddress = EMPTY_ADDRESS;
    const artifactOwner = getComponentValue(ArtifactOwner, artifactEntity);

    if (artifactOwner) {
      planetId = locationIdFromHexStr(artifactOwner.planet.toString());

      const planetOwner = getComponentValue(
        PlanetOwner,
        encodeEntity(PlanetConstants.metadata.keySchema, {
          id: locationIdToHexStr(planetId) as `0x${string}`,
        }),
      );
      if (planetOwner) {
        owner = address(planetOwner.value);
      }
    }

    let metadata;
    if (artifactRec.artifactIndex === 1) {
      metadata = getComponentValue(
        PinkBombMetadata,
        encodeEntity({ rarity: "uint8" }, { rarity: artifactRec.rarity }),
      );
    } else if (artifactRec.artifactIndex === 3) {
      // Spaceship artifacts - use fallback metadata since SpaceshipMetadata table doesn't exist yet
      metadata = {
        rarity: artifactRec.rarity,
        genre: 0, // General
        charge: 0,
        cooldown: 0,
        durable: true,
        reusable: true,
        reqLevel: 4, // Minimum level for spaceships
        reqPopulation: BigInt(0),
        reqSilver: BigInt(0),
      };
    } else if (artifactRec.artifactIndex === 4) {
      metadata = getComponentValue(
        BloomFilterMetadata,
        encodeEntity({ rarity: "uint8" }, { rarity: artifactRec.rarity }),
      );
    } else if (artifactRec.artifactIndex === 5) {
      metadata = getComponentValue(
        WormholeMetadata,
        encodeEntity({ rarity: "uint8" }, { rarity: artifactRec.rarity }),
      );
    } else if (artifactRec.artifactIndex === 6) {
      metadata = getComponentValue(
        CannonMetadata,
        encodeEntity({ rarity: "uint8" }, { rarity: artifactRec.rarity }),
      );
    }

    if (!metadata && artifactRec.artifactIndex !== 3) {
      throw new Error(
        `artifact metadata not found, artifact index: ${artifactRec.artifactIndex}, rarity: ${artifactRec.rarity}`,
      );
    }

    const artifactType = this.getArtifactType(artifactRec.artifactIndex);
    const { chargeUpgrade, activateUpgrade } = this.getArtifactUpgrade(
      artifactType,
      artifactRec.rarity as ArtifactRarity,
    );

    // Get spaceship type from CraftedSpaceship table if this is a spaceship
    let spaceshipType: number | undefined;
    if (artifactRec.artifactIndex === 3) {
      const craftedSpaceshipEntity = encodeEntity(
        CraftedSpaceship.metadata.keySchema,
        { artifactId: Number(artifactIdToDecStr(artifactId)) },
      );
      const craftedSpaceshipData = getComponentValue(
        CraftedSpaceship,
        craftedSpaceshipEntity,
      );
      if (craftedSpaceshipData) {
        spaceshipType = craftedSpaceshipData.spaceshipType;
      }
    }

    return {
      isInititalized: true,
      imageType: 0,
      id: artifactId,
      planetDiscoveredOn: "0" as LocationId,
      rarity: artifactRec.rarity as ArtifactRarity,
      planetBiome: artifactRec.biome as Biome,
      mintedAtTimestamp: 0,
      discoverer: EMPTY_ADDRESS,
      artifactType,
      controller: owner,
      currentOwner: owner,
      activations: 0,
      lastActivated: Number(artifactRec.activateTick),
      lastDeactivated: Number(artifactRec.cooldownTick),
      onPlanetId: planetId === "0" ? undefined : planetId,
      artifactIndex: artifactRec.artifactIndex,
      status: artifactRec.status as ArtifactStatus,
      genre: metadata.genre as ArtifactGenre,
      chargeTick: Number(artifactRec.chargeTick),
      activateTick: Number(artifactRec.activateTick),
      cooldownTick: Number(artifactRec.cooldownTick),
      charge: metadata.charge,
      cooldown: metadata.cooldown,
      durable: metadata.durable,
      reusable: metadata.reusable,
      reqLevel: metadata.reqLevel,
      reqPopulation: metadata.reqPopulation,
      reqSilver: metadata.reqSilver,
      chargeUpgrade,
      activateUpgrade,
      spaceshipType: spaceshipType, // Add spaceship type from CraftedSpaceship table
      transactions: new TxCollection(),
    };
  }

  public getArtifactByNFT(
    tokenId: bigint,
    owner: EthAddress,
    index: number,
    rarity: number,
    biome: number,
  ): Artifact | undefined {
    const artifactId = artifactIdFromDecStr(tokenId.toString());
    const {
      PinkBombMetadata,
      BloomFilterMetadata,
      WormholeMetadata,
      CannonMetadata,
    } = this.components;

    let metadata;
    if (index === 1) {
      metadata = getComponentValue(
        PinkBombMetadata,
        encodeEntity({ rarity: "uint8" }, { rarity: rarity }),
      );
    } else if (index === 3) {
      // Spaceship artifacts - use fallback metadata since SpaceshipMetadata table doesn't exist yet
      metadata = {
        rarity: rarity,
        genre: 0, // General
        charge: 0,
        cooldown: 0,
        durable: true,
        reusable: true,
        reqLevel: 4, // Minimum level for spaceships
        reqPopulation: BigInt(0),
        reqSilver: BigInt(0),
      };
    } else if (index === 4) {
      metadata = getComponentValue(
        BloomFilterMetadata,
        encodeEntity({ rarity: "uint8" }, { rarity: rarity }),
      );
    } else if (index === 5) {
      metadata = getComponentValue(
        WormholeMetadata,
        encodeEntity({ rarity: "uint8" }, { rarity: rarity }),
      );
    } else if (index === 6) {
      metadata = getComponentValue(
        CannonMetadata,
        encodeEntity({ rarity: "uint8" }, { rarity: rarity }),
      );
    }

    if (!metadata && index !== 3) {
      throw new Error(
        `artifact metadata not found, artifact index: ${index}, rarity: ${rarity}`,
      );
    }

    const artifactType = this.getArtifactType(index);
    const { chargeUpgrade, activateUpgrade } = this.getArtifactUpgrade(
      artifactType,
      rarity as ArtifactRarity,
    );

    return {
      isInititalized: false,
      imageType: 0,
      id: artifactId,
      planetDiscoveredOn: "0" as LocationId,
      rarity: rarity as ArtifactRarity,
      planetBiome: biome as Biome,
      mintedAtTimestamp: 0,
      discoverer: EMPTY_ADDRESS,
      artifactType,
      controller: owner,
      currentOwner: owner,
      activations: 0,
      lastActivated: 0,
      lastDeactivated: 0,
      onPlanetId: undefined,
      artifactIndex: index,
      status: ArtifactStatus.Default,
      genre: metadata.genre as ArtifactGenre,
      chargeTick: 0,
      activateTick: 0,
      cooldownTick: 0,
      charge: metadata.charge,
      cooldown: metadata.cooldown,
      durable: metadata.durable,
      reusable: metadata.reusable,
      reqLevel: metadata.reqLevel,
      reqPopulation: metadata.reqPopulation,
      reqSilver: metadata.reqSilver,
      chargeUpgrade,
      activateUpgrade,
      transactions: new TxCollection(),
    };
  }

  private getArtifactType(index: number): ArtifactType {
    if (index === 1) {
      return ArtifactType.Bomb;
    } else if (index === 3) {
      return ArtifactType.Spaceship; // Spaceship artifacts
    } else if (index === 4) {
      return ArtifactType.BloomFilter;
    } else if (index === 5) {
      return ArtifactType.Wormhole;
    } else if (index === 6) {
      return ArtifactType.PhotoidCannon;
    }
    return ArtifactType.Unknown;
  }

  private getArtifactUpgrade(
    artifactType: ArtifactType,
    rarity: ArtifactRarity,
  ): {
    chargeUpgrade?: Upgrade;
    activateUpgrade?: Upgrade;
  } {
    if (artifactType === ArtifactType.Bomb) {
      return {
        chargeUpgrade: undefined,
        activateUpgrade: {
          energyCapMultiplier: 100,
          energyGroMultiplier: 100,
          rangeMultiplier: 50,
          speedMultiplier: 50,
          defMultiplier: 100,
        },
      };
    } else if (artifactType === ArtifactType.PhotoidCannon) {
      const defenseMultiplier = [0, 50, 40, 30, 20, 10][rarity];
      const speedMultiplier = [0, 500, 1000, 1500, 2000, 2500][rarity];
      return {
        chargeUpgrade: {
          energyCapMultiplier: 100,
          energyGroMultiplier: 100,
          rangeMultiplier: 100,
          speedMultiplier: 100,
          defMultiplier: defenseMultiplier,
        },
        activateUpgrade: {
          energyCapMultiplier: 100,
          energyGroMultiplier: 100,
          rangeMultiplier: 200,
          speedMultiplier,
          defMultiplier: 100,
        },
      };
    }
    return {
      chargeUpgrade: undefined,
      activateUpgrade: undefined,
    };
  }
}

export const updateArtifactStatus = (
  artifact: Artifact,
  curTick: number,
): void => {
  if (
    artifact.status === ArtifactStatus.Cooldown &&
    curTick >= artifact.cooldownTick + artifact.cooldown
  ) {
    artifact.status = ArtifactStatus.Default;
  } else if (
    artifact.status === ArtifactStatus.Charging &&
    curTick >= artifact.chargeTick + artifact.charge
  ) {
    artifact.status = ArtifactStatus.Ready;
  }
};
