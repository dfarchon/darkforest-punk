// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { IBaseWorld } from "@latticexyz/world/src/codegen/interfaces/IBaseWorld.sol";
import { ResourceId } from "@latticexyz/store/src/ResourceId.sol";
import { BaseInstallLibrary } from "../BaseInstallLibrary.sol";
import { ArtifactInstallModule } from "../ArtifactInstallModule.sol";
import { ArtifactMetadata, ArtifactMetadataData } from "../tables/ArtifactMetadata.sol";
import { _artifactMetadataTableId } from "../utils.sol";
import { ArtifactRarity, ArtifactGenre } from "../../../codegen/common.sol";
import { AtfInstallModule } from "../../../codegen/tables/AtfInstallModule.sol";
import { SpaceshipDefenseSystem } from "./SpaceshipDefenseSystem.sol";
import { ARTIFACT_INDEX } from "./constant.sol";

function installSpaceshipDefense(address world) returns (uint256 index) {
  address moduleAddr = AtfInstallModule.get();
  require(moduleAddr != address(0), "ArtifactInstallModule not found");

  SpaceshipDefenseSystem artifactProxySystem = new SpaceshipDefenseSystem();
  IBaseWorld(world).installModule(
    ArtifactInstallModule(moduleAddr),
    abi.encode(new SpaceshipDefenseInstallLibrary(), artifactProxySystem)
  );

  return ARTIFACT_INDEX;
}

contract SpaceshipDefenseInstallLibrary is BaseInstallLibrary {
  function _artifactIndex() internal pure override returns (uint8) {
    return ARTIFACT_INDEX;
  }

  function _install(IBaseWorld, bytes14 namespace) internal override {
    _setMetadata(namespace);
  }

  function _setMetadata(bytes14 namespace) internal {
    ResourceId metadataTableId = _artifactMetadataTableId(namespace);
    ArtifactMetadataData memory metadata = ArtifactMetadataData({
      genre: ArtifactGenre.DEFENSIVE,
      charge: 0,
      cooldown: 7200,
      durable: true,
      reusable: true,
      reqLevel: 0,
      reqPopulation: 0,
      reqSilver: 0
    });

    ArtifactMetadata.set(metadataTableId, ArtifactRarity.COMMON, metadata);
    ArtifactMetadata.set(metadataTableId, ArtifactRarity.RARE, metadata);
    ArtifactMetadata.set(metadataTableId, ArtifactRarity.EPIC, metadata);
    ArtifactMetadata.set(metadataTableId, ArtifactRarity.LEGENDARY, metadata);
    ArtifactMetadata.set(metadataTableId, ArtifactRarity.MYTHIC, metadata);
  }
}
