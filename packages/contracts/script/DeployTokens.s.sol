// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { stdToml } from "forge-std/StdToml.sol";
import { StoreSwitch } from "@latticexyz/store/src/StoreSwitch.sol";
import { TokenDeploymentHelper } from "../src/systems/TokenDeploymentHelper.sol";
import { TokenRegistry } from "../src/tokens/TokenRegistry.sol";
import { ArtifactNFT } from "../src/tokens/ArtifactNFT.sol";
import { MaterialToken } from "../src/tokens/MaterialToken.sol";
import { ArtifactNFT as ArtifactNFTTable } from "../src/codegen/index.sol";
import { MaterialToken as MaterialTokenTable } from "../src/codegen/index.sol";
import { IArtifactNFT } from "../src/tokens/IArtifactNFT.sol";
import { IMaterialToken } from "../src/tokens/IMaterialToken.sol";

/**
 * @title DeployTokens
 * @dev Script to deploy or reuse token contracts (ArtifactNFT and MaterialToken)
 * @notice Checks for existing deployments and reuses them if they support both interfaces
 */
contract DeployTokens is Script {
  using stdToml for string;

  function run(address worldAddress) external {
    StoreSwitch.setStoreAddress(worldAddress);

    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
    vm.startBroadcast(deployerPrivateKey);

    // Load configuration from toml file
    string memory toml = vm.readFile(".df.toml");

    // Get existing addresses from config (if any)
    address existingArtifactNFT = address(0);
    address existingMaterialToken = address(0);
    address royaltyRecipient = address(0);

    if (toml.keyExists(".artifact_nft.address")) {
      existingArtifactNFT = toml.readAddress(".artifact_nft.address");
    }

    if (toml.keyExists(".material_token.address")) {
      existingMaterialToken = toml.readAddress(".material_token.address");
    }

    if (toml.keyExists(".royalty_recipient")) {
      royaltyRecipient = toml.readAddress(".royalty_recipient");
    }

    // Default to deployer if no royalty recipient specified
    if (royaltyRecipient == address(0)) {
      royaltyRecipient = vm.addr(deployerPrivateKey);
    }

    console.log("=== Token Deployment Helper ===");
    console.log("Existing ArtifactNFT: %s", existingArtifactNFT);
    console.log("Existing MaterialToken: %s", existingMaterialToken);
    console.log("Royalty Recipient: %s", royaltyRecipient);

    // Check existing contracts
    if (existingArtifactNFT != address(0)) {
      (bool erc721, bool erc1155, bool erc2981) = TokenRegistry.checkContractSupport(existingArtifactNFT);
      console.log("ArtifactNFT supports - ERC721: %s, ERC1155: %s, ERC2981: %s", erc721, erc1155, erc2981);
    }

    if (existingMaterialToken != address(0)) {
      (bool erc721, bool erc1155, bool erc2981) = TokenRegistry.checkContractSupport(existingMaterialToken);
      console.log("MaterialToken supports - ERC721: %s, ERC1155: %s, ERC2981: %s", erc721, erc1155, erc2981);
    }

    // Deploy or reuse contracts
    TokenDeploymentHelper.DeploymentResult memory result = TokenDeploymentHelper.deployOrReuseTokens(
      existingArtifactNFT,
      existingMaterialToken,
      royaltyRecipient,
      vm.addr(deployerPrivateKey)
    );

    console.log("\n=== Deployment Result ===");
    console.log("ArtifactNFT Address: %s", result.artifactNFTAddress);
    console.log("MaterialToken Address: %s", result.materialTokenAddress);
    console.log("ArtifactNFT Reused: %s", result.artifactNFTReused);
    console.log("MaterialToken Reused: %s", result.materialTokenReused);

    // Set addresses in MUD tables
    ArtifactNFTTable.set(result.artifactNFTAddress);
    MaterialTokenTable.set(result.materialTokenAddress);

    // Configure contracts if newly deployed
    if (!result.artifactNFTReused) {
      _configureArtifactNFT(result.artifactNFTAddress, toml, worldAddress);
    }

    if (!result.materialTokenReused) {
      _configureMaterialToken(result.materialTokenAddress, toml);
    }

    vm.stopBroadcast();
  }

  function _configureArtifactNFT(address nftAddress, string memory toml, address worldAddress) internal {
    IArtifactNFT nft = IArtifactNFT(nftAddress);

    // Set round if needed
    if (toml.keyExists(".artifact_nft.set_current_round") && toml.readBool(".artifact_nft.set_current_round")) {
      uint8 roundNum = uint8(toml.readUint(".round.number"));
      nft.setDF(roundNum, worldAddress);
      console.log("Configured ArtifactNFT round: %d", roundNum);
    }
  }

  function _configureMaterialToken(address tokenAddress, string memory toml) internal {
    // MaterialToken configuration can be added here
    console.log("Configured MaterialToken");
  }
}
