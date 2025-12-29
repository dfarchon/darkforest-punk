// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { TokenRegistry } from "tokens/TokenRegistry.sol";
import { ArtifactNFT } from "tokens/ArtifactNFT.sol";
import { MaterialToken } from "tokens/MaterialToken.sol";
import { IArtifactNFT } from "tokens/IArtifactNFT.sol";
import { IMaterialToken } from "tokens/IMaterialToken.sol";

/**
 * @title TokenDeploymentHelper
 * @dev Helper contract to deploy or reuse token contracts
 * @notice Checks if contracts are already deployed and can be reused, or deploys new ones
 */
library TokenDeploymentHelper {
  struct DeploymentResult {
    address artifactNFTAddress;
    address materialTokenAddress;
    bool artifactNFTReused; // true if existing contract was reused
    bool materialTokenReused; // true if existing contract was reused
  }

  /**
   * @notice Deploy or reuse token contracts
   * @param existingArtifactNFT Existing ArtifactNFT address (can be address(0))
   * @param existingMaterialToken Existing MaterialToken address (can be address(0))
   * @param royaltyRecipient Address to receive royalties
   * @param deployer Address deploying the contracts
   * @return result Deployment result with addresses and flags
   */
  function deployOrReuseTokens(
    address existingArtifactNFT,
    address existingMaterialToken,
    address royaltyRecipient,
    address deployer
  ) internal returns (DeploymentResult memory result) {
    // Check if existing ArtifactNFT can be reused
    if (existingArtifactNFT != address(0)) {
      bool canUseAsArtifact = TokenRegistry.canUseAsArtifactNFT(existingArtifactNFT);
      if (canUseAsArtifact) {
        result.artifactNFTAddress = existingArtifactNFT;
        result.artifactNFTReused = true;
      }
    }

    // Check if existing MaterialToken can be reused
    if (existingMaterialToken != address(0)) {
      bool canUseAsMaterial = TokenRegistry.canUseAsMaterialToken(existingMaterialToken);
      if (canUseAsMaterial) {
        result.materialTokenAddress = existingMaterialToken;
        result.materialTokenReused = true;
      }
    }

    // Deploy new contracts if needed
    if (result.artifactNFTAddress == address(0)) {
      // Deploy only ArtifactNFT
      ArtifactNFT artifactNFT = new ArtifactNFT();
      result.artifactNFTAddress = address(artifactNFT);
    }

    if (result.materialTokenAddress == address(0)) {
      // Deploy only MaterialToken
      MaterialToken materialToken = new MaterialToken("https://darkforest.punk/api/materials/", royaltyRecipient);
      result.materialTokenAddress = address(materialToken);
    }
  }
}
