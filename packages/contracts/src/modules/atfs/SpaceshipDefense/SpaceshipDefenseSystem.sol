// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { Planet } from "../../../lib/Planet.sol";
import { Artifact } from "../../../lib/Artifact.sol";
import { SpaceshipBonus } from "../../../codegen/tables/SpaceshipBonus.sol";
import { ArtifactProxySystem } from "../ArtifactProxySystem.sol";
import { Errors } from "../../../interfaces/errors.sol";
import { ARTIFACT_INDEX } from "./constant.sol";

contract SpaceshipDefenseSystem is ArtifactProxySystem {
  mapping(uint32 => uint128) private _activeDefenseDelta;

  function getArtifactIndex() public pure override returns (uint8) {
    return ARTIFACT_INDEX;
  }

  function _activate(Planet memory planet, Artifact memory artifact, bytes memory inputData) internal virtual override {
    // Check if cooldown has passed since last shutdown
    if (artifact.cooldown > 0 && artifact.cooldownTick > 0) {
      if (planet.lastUpdateTick < artifact.cooldownTick + artifact.cooldown) {
        revert Errors.ArtifactOnCooldown();
      }
    }

    super._activate(planet, artifact, inputData);

    uint32 spaceshipId = uint32(artifact.id);
    uint16 defenseBonus = SpaceshipBonus.getDefenseBonus(spaceshipId);
    if (defenseBonus == 0) {
      _activeDefenseDelta[spaceshipId] = 0;
      return;
    }

    uint256 baseDefense = planet.defense;
    uint256 bonusAmount = (baseDefense * defenseBonus) / 100;
    if (bonusAmount == 0) {
      _activeDefenseDelta[spaceshipId] = 0;
      return;
    }

    planet.defense = baseDefense + bonusAmount;
    planet.updateProps = true;
    _activeDefenseDelta[spaceshipId] = uint128(bonusAmount);
  }

  function _shutdown(Planet memory planet, Artifact memory artifact) internal virtual override {
    super._shutdown(planet, artifact);

    uint32 spaceshipId = uint32(artifact.id);
    uint128 appliedBonus = _activeDefenseDelta[spaceshipId];
    if (appliedBonus == 0) {
      return;
    }

    if (planet.defense >= appliedBonus) {
      planet.defense -= appliedBonus;
    } else {
      planet.defense = 0;
    }

    planet.updateProps = true;
    delete _activeDefenseDelta[spaceshipId];
  }
}
