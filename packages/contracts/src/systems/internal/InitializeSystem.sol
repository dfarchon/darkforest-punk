// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { BaseSystem } from "systems/internal/BaseSystem.sol";
import { PlanetMetadata, PlanetMetadataData } from "codegen/tables/PlanetMetadata.sol";
import { PlanetInitialResource, PlanetInitialResourceData } from "codegen/tables/PlanetInitialResource.sol";
import { SpaceType, PlanetType } from "codegen/common.sol";

contract InitializeSystem is BaseSystem {
  function setPlanetMetadata(
    uint8 level,
    PlanetMetadataData memory metadata,
    uint256 initialPopulationPercentage
  ) public {
    PlanetMetadataData memory md;
    // NEBULA
    md.range = metadata.range;
    md.speed = metadata.speed;
    md.populationCap = metadata.populationCap;
    md.populationGrowth = metadata.populationGrowth;
    md.silverCap = metadata.silverCap;
    md.silverGrowth = metadata.silverGrowth;
    md.defense = metadata.defense;
    _initPlanetMetadataWithSpaceType(SpaceType.NEBULA, level, md, initialPopulationPercentage);

    // SPACE
    md.range = (metadata.range * 5) / 4;
    md.speed = (metadata.speed * 5) / 4;
    md.populationCap = (metadata.populationCap * 5) / 4;
    md.populationGrowth = (metadata.populationGrowth * 5) / 4;
    md.silverCap = (metadata.silverCap * 5) / 4;
    md.silverGrowth = (metadata.silverGrowth * 5) / 4;
    md.defense = metadata.defense / 2;
    _initPlanetMetadataWithSpaceType(SpaceType.SPACE, level, md, initialPopulationPercentage * 4);

    // DEEP_SPACE
    md.range = (metadata.range * 3) / 2;
    md.speed = (metadata.speed * 3) / 2;
    md.populationCap = (metadata.populationCap * 3) / 2;
    md.populationGrowth = (metadata.populationGrowth * 3) / 2;
    md.silverCap = (metadata.silverCap * 3) / 2;
    md.silverGrowth = (metadata.silverGrowth * 3) / 2;
    md.defense = metadata.defense / 4;
    _initPlanetMetadataWithSpaceType(SpaceType.DEEP_SPACE, level, md, initialPopulationPercentage * 10);

    // DEAD_SPACE * 2
    md.range = metadata.range * 2;
    md.speed = metadata.speed * 2;
    md.populationCap = metadata.populationCap * 2;
    md.populationGrowth = metadata.populationGrowth * 2;
    md.silverCap = metadata.silverCap * 2;
    md.silverGrowth = metadata.silverGrowth * 2;
    md.defense = (metadata.defense * 3) / 20;
    _initPlanetMetadataWithSpaceType(SpaceType.DEAD_SPACE, level, md, initialPopulationPercentage * 20);
  }

  /**
   * @dev
   * ASTEROID_FIELD: 1/2 defense, double silverCap
   * SPACETIME_RIP: 1/2 defense, double silverCap, no silverGrowth
   * PLANET: no silver, no silverGrowth
   * FOUNDRY: no silver, no silverGrowth
   * QUASAR: double speed, no silverGrowth, 10 times silverCap, no populationGrowth, 5 times populationCap
   * SUN: similar to QUASAR but optimized for SOLAR_ENERGY generation
   */
  function _initPlanetMetadataWithSpaceType(
    SpaceType spaceType,
    uint8 level,
    PlanetMetadataData memory metadata,
    uint256 initialPopulationPercentage
  ) internal {
    uint256 defense = metadata.defense;
    uint32 originalSilverGrowth = metadata.silverGrowth; // Save original silverGrowth before modifications
    metadata.defense /= 2;
    metadata.silverCap *= 2;
    PlanetMetadata.set(spaceType, PlanetType.ASTEROID_FIELD, level, metadata);
    uint64 population = uint64((metadata.populationCap * initialPopulationPercentage) / 100);
    PlanetInitialResource.set(
      spaceType,
      PlanetType.ASTEROID_FIELD,
      level,
      PlanetInitialResourceData(population, metadata.silverCap / 2)
    );
    metadata.silverGrowth = 0;
    PlanetMetadata.set(spaceType, PlanetType.SPACETIME_RIP, level, metadata);
    PlanetInitialResource.set(spaceType, PlanetType.SPACETIME_RIP, level, PlanetInitialResourceData(population, 0));
    metadata.defense = uint16(defense);
    metadata.silverCap /= 2;
    PlanetMetadata.set(spaceType, PlanetType.PLANET, level, metadata);
    PlanetInitialResource.set(spaceType, PlanetType.PLANET, level, PlanetInitialResourceData(population, 0));
    PlanetMetadata.set(spaceType, PlanetType.FOUNDRY, level, metadata);
    PlanetInitialResource.set(spaceType, PlanetType.FOUNDRY, level, PlanetInitialResourceData(population, 0));
    metadata.silverCap *= 10;
    metadata.populationCap *= 5;
    population *= 5;
    metadata.speed *= 2;
    metadata.populationGrowth = 0;
    PlanetMetadata.set(spaceType, PlanetType.QUASAR, level, metadata);
    PlanetInitialResource.set(spaceType, PlanetType.QUASAR, level, PlanetInitialResourceData(population / 2, 0));

    // SUN: Similar to QUASAR but optimized for SOLAR_ENERGY generation
    // Restore silverGrowth for materialsStorage (SOLAR_ENERGY) to grow (QUASAR has silverGrowth = 0, but SUN needs it)
    // Note: silverGrowth is kept for materialsStorage growth calculation, but silver itself doesn't grow on SUN planets
    metadata.silverGrowth = originalSilverGrowth; // Restore original silverGrowth for SOLAR_ENERGY growth
    PlanetMetadata.set(spaceType, PlanetType.SUN, level, metadata);
    PlanetInitialResource.set(spaceType, PlanetType.SUN, level, PlanetInitialResourceData(population / 2, 5000 * 1000));
  }
}
