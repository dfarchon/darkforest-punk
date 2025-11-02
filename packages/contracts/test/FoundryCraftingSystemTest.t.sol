// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import { BaseTest } from "./BaseTest.t.sol";
import { IWorld } from "../src/codegen/world/IWorld.sol";
import { FoundryCraftingSystem } from "../src/systems/FoundryCraftingSystem.sol";
import { CraftedSpaceship, CraftedSpaceshipData } from "../src/codegen/tables/CraftedSpaceship.sol";
import { SpaceshipBonus, SpaceshipBonusData } from "../src/codegen/tables/SpaceshipBonus.sol";
import { FoundryCraftingCount, FoundryCraftingCountData } from "../src/codegen/tables/FoundryCraftingCount.sol";
import { Planet as PlanetTable } from "../src/codegen/index.sol";
import { PlanetType, MaterialType, Biome, ArtifactRarity, SpaceType } from "../src/codegen/common.sol";
import { Planet } from "../src/lib/Planet.sol";
import { Errors } from "../src/interfaces/errors.sol";
import { PlanetArtifact } from "../src/codegen/tables/PlanetArtifact.sol";
import { Counter } from "../src/codegen/index.sol";

contract FoundryCraftingSystemTest is BaseTest {
  FoundryCraftingSystem foundryCraftingSystem;
  uint256 foundryHash;

  function setUp() public override {
    super.setUp();

    vm.startPrank(admin);
    // Create a foundry planet (level 4+) owned by user1
    foundryHash = 1;
    IWorld(worldAddress).df__createPlanet(
      foundryHash,
      user1,
      0,
      4, // level 4 (minimum for crafting)
      PlanetType.FOUNDRY,
      SpaceType.NEBULA,
      300000, // population
      10000, // silver
      0
    );

    // Add materials to foundry
    IWorld(worldAddress).df__addMaterial(foundryHash, MaterialType.WINDSTEEL, 1000 * 1e18); // 1000 units in wei
    IWorld(worldAddress).df__addMaterial(foundryHash, MaterialType.AURORIUM, 500 * 1e18); // 500 units in wei

    foundryCraftingSystem = FoundryCraftingSystem(worldAddress);
    vm.stopPrank();
  }

  function testCraftSpaceship_Scout() public {
    vm.prank(user1);
    MaterialType[] memory materials = new MaterialType[](2);
    materials[0] = MaterialType.WINDSTEEL;
    materials[1] = MaterialType.AURORIUM;

    uint256[] memory amounts = new uint256[](2);
    amounts[0] = 100 * 1e18; // 100 units (base amount)
    amounts[1] = 50 * 1e18; // 50 units (base amount)

    foundryCraftingSystem.craftSpaceship(
      foundryHash,
      1, // Scout
      materials,
      amounts,
      Biome.OCEAN
    );

    // Check crafting count increased
    FoundryCraftingCountData memory craftingData = FoundryCraftingCount.get(bytes32(foundryHash));
    assertEq(craftingData.count, 1);

    // Check materials were consumed (with 100% multiplier for first craft)
    Planet memory foundry = IWorld(worldAddress).df__readPlanet(foundryHash);
    assertEq(foundry.getMaterial(MaterialType.WINDSTEEL), 900 * 1e18); // 1000 - 100
    assertEq(foundry.getMaterial(MaterialType.AURORIUM), 450 * 1e18); // 500 - 50

    // Check spaceship was created (verify artifact exists on planet)
    uint256 artifacts = PlanetArtifact.getArtifacts(bytes32(foundryHash));
    assertGt(artifacts, 0);
    assertEq(Counter.getArtifact(), 1);
  }

  function testCraftSpaceship_RevertIfWrongRecipe() public {
    vm.prank(user1);
    // Try to craft Scout with wrong materials (Destroyer materials)
    MaterialType[] memory materials = new MaterialType[](2);
    materials[0] = MaterialType.BLACKALLOY; // Wrong material for Scout
    materials[1] = MaterialType.CORRUPTED_CRYSTAL; // Wrong material for Scout

    uint256[] memory amounts = new uint256[](2);
    amounts[0] = 200 * 1e18;
    amounts[1] = 100 * 1e18;

    // Add these materials to foundry first
    vm.stopPrank();
    vm.startPrank(admin);
    IWorld(worldAddress).df__addMaterial(foundryHash, MaterialType.BLACKALLOY, 1000 * 1e18);
    IWorld(worldAddress).df__addMaterial(foundryHash, MaterialType.CORRUPTED_CRYSTAL, 1000 * 1e18);
    vm.stopPrank();

    vm.prank(user1);
    // Should revert with InvalidMaterialAmount or MissingRequiredMaterials
    vm.expectRevert();
    foundryCraftingSystem.craftSpaceship(
      foundryHash,
      1, // Scout - but using Destroyer materials
      materials,
      amounts,
      Biome.OCEAN
    );
  }

  function testCraftSpaceship_RevertIfWrongAmounts() public {
    vm.prank(user1);
    MaterialType[] memory materials = new MaterialType[](2);
    materials[0] = MaterialType.WINDSTEEL;
    materials[1] = MaterialType.AURORIUM;

    uint256[] memory amounts = new uint256[](2);
    amounts[0] = 150 * 1e18; // Wrong amount (should be 100)
    amounts[1] = 50 * 1e18; // Correct amount

    vm.expectRevert();
    foundryCraftingSystem.craftSpaceship(
      foundryHash,
      1, // Scout
      materials,
      amounts,
      Biome.OCEAN
    );
  }

  function testCraftSpaceship_RevertIfExtraMaterials() public {
    vm.prank(user1);
    MaterialType[] memory materials = new MaterialType[](3); // 3 materials instead of 2
    materials[0] = MaterialType.WINDSTEEL;
    materials[1] = MaterialType.AURORIUM;
    materials[2] = MaterialType.PYROSTEEL; // Extra material

    uint256[] memory amounts = new uint256[](3);
    amounts[0] = 100 * 1e18;
    amounts[1] = 50 * 1e18;
    amounts[2] = 10 * 1e18;

    vm.expectRevert();
    foundryCraftingSystem.craftSpaceship(
      foundryHash,
      1, // Scout
      materials,
      amounts,
      Biome.OCEAN
    );
  }

  function testCraftSpaceship_RevertIfDuplicateMaterials() public {
    vm.prank(user1);
    MaterialType[] memory materials = new MaterialType[](2);
    materials[0] = MaterialType.WINDSTEEL;
    materials[1] = MaterialType.WINDSTEEL; // Duplicate

    uint256[] memory amounts = new uint256[](2);
    amounts[0] = 100 * 1e18;
    amounts[1] = 50 * 1e18;

    vm.expectRevert();
    foundryCraftingSystem.craftSpaceship(
      foundryHash,
      1, // Scout
      materials,
      amounts,
      Biome.OCEAN
    );
  }

  function testCraftSpaceship_DestroyerRecipe() public {
    vm.startPrank(admin);
    // Add Destroyer materials
    IWorld(worldAddress).df__addMaterial(foundryHash, MaterialType.BLACKALLOY, 1000 * 1e18);
    IWorld(worldAddress).df__addMaterial(foundryHash, MaterialType.CORRUPTED_CRYSTAL, 1000 * 1e18);
    vm.stopPrank();

    vm.prank(user1);
    MaterialType[] memory materials = new MaterialType[](2);
    materials[0] = MaterialType.BLACKALLOY;
    materials[1] = MaterialType.CORRUPTED_CRYSTAL;

    uint256[] memory amounts = new uint256[](2);
    amounts[0] = 200 * 1e18; // Base amount for Destroyer
    amounts[1] = 100 * 1e18; // Base amount for Destroyer

    foundryCraftingSystem.craftSpaceship(
      foundryHash,
      3, // Destroyer
      materials,
      amounts,
      Biome.OCEAN
    );

    // Verify materials consumed
    Planet memory foundry = IWorld(worldAddress).df__readPlanet(foundryHash);
    assertEq(foundry.getMaterial(MaterialType.BLACKALLOY), 800 * 1e18); // 1000 - 200
    assertEq(foundry.getMaterial(MaterialType.CORRUPTED_CRYSTAL), 900 * 1e18); // 1000 - 100
  }

  function testCraftSpaceship_CarrierRecipe() public {
    vm.startPrank(admin);
    // Add Carrier materials
    IWorld(worldAddress).df__addMaterial(foundryHash, MaterialType.LIVING_WOOD, 1000 * 1e18);
    IWorld(worldAddress).df__addMaterial(foundryHash, MaterialType.CRYOSTONE, 1000 * 1e18);
    vm.stopPrank();

    vm.prank(user1);
    MaterialType[] memory materials = new MaterialType[](2);
    materials[0] = MaterialType.LIVING_WOOD;
    materials[1] = MaterialType.CRYOSTONE;

    uint256[] memory amounts = new uint256[](2);
    amounts[0] = 200 * 1e18; // Base amount for Carrier
    amounts[1] = 150 * 1e18; // Base amount for Carrier

    foundryCraftingSystem.craftSpaceship(
      foundryHash,
      4, // Carrier
      materials,
      amounts,
      Biome.OCEAN
    );

    // Verify materials consumed
    Planet memory foundry = IWorld(worldAddress).df__readPlanet(foundryHash);
    assertEq(foundry.getMaterial(MaterialType.LIVING_WOOD), 800 * 1e18); // 1000 - 200
    assertEq(foundry.getMaterial(MaterialType.CRYOSTONE), 850 * 1e18); // 1000 - 150
  }

  function testCraftSpaceship_FighterRecipe() public {
    vm.startPrank(admin);
    // Add Fighter materials
    IWorld(worldAddress).df__addMaterial(foundryHash, MaterialType.PYROSTEEL, 1000 * 1e18);
    IWorld(worldAddress).df__addMaterial(foundryHash, MaterialType.SCRAPIUM, 1000 * 1e18);
    vm.stopPrank();

    vm.prank(user1);
    MaterialType[] memory materials = new MaterialType[](2);
    materials[0] = MaterialType.PYROSTEEL;
    materials[1] = MaterialType.SCRAPIUM;

    uint256[] memory amounts = new uint256[](2);
    amounts[0] = 150 * 1e18; // Base amount for Fighter
    amounts[1] = 100 * 1e18; // Base amount for Fighter

    foundryCraftingSystem.craftSpaceship(
      foundryHash,
      2, // Fighter
      materials,
      amounts,
      Biome.OCEAN
    );

    // Verify materials consumed
    Planet memory foundry = IWorld(worldAddress).df__readPlanet(foundryHash);
    assertEq(foundry.getMaterial(MaterialType.PYROSTEEL), 850 * 1e18); // 1000 - 150
    assertEq(foundry.getMaterial(MaterialType.SCRAPIUM), 900 * 1e18); // 1000 - 100
  }

  function testCraftSpaceship_CraftingMultiplier() public {
    vm.startPrank(admin);
    // Add Scout materials
    IWorld(worldAddress).df__addMaterial(foundryHash, MaterialType.WINDSTEEL, 2000 * 1e18);
    IWorld(worldAddress).df__addMaterial(foundryHash, MaterialType.AURORIUM, 2000 * 1e18);
    vm.stopPrank();

    vm.startPrank(user1);
    MaterialType[] memory materials = new MaterialType[](2);
    materials[0] = MaterialType.WINDSTEEL;
    materials[1] = MaterialType.AURORIUM;
    uint256[] memory amounts = new uint256[](2);
    amounts[0] = 100 * 1e18; // Base amount
    amounts[1] = 50 * 1e18; // Base amount

    // First craft - 100% multiplier
    foundryCraftingSystem.craftSpaceship(foundryHash, 1, materials, amounts, Biome.OCEAN);
    Planet memory foundry = IWorld(worldAddress).df__readPlanet(foundryHash);
    uint256 remainingAfterFirst = foundry.getMaterial(MaterialType.WINDSTEEL);
    assertEq(remainingAfterFirst, 1900 * 1e18); // 2000 - 100

    // Second craft - 150% multiplier
    foundryCraftingSystem.craftSpaceship(foundryHash, 1, materials, amounts, Biome.OCEAN);
    foundry = IWorld(worldAddress).df__readPlanet(foundryHash);
    uint256 remainingAfterSecond = foundry.getMaterial(MaterialType.WINDSTEEL);
    // Should consume 150 units (100 * 1.5)
    assertEq(remainingAfterSecond, 1750 * 1e18); // 1900 - 150

    // Third craft - 225% multiplier
    foundryCraftingSystem.craftSpaceship(foundryHash, 1, materials, amounts, Biome.OCEAN);
    foundry = IWorld(worldAddress).df__readPlanet(foundryHash);
    uint256 remainingAfterThird = foundry.getMaterial(MaterialType.WINDSTEEL);
    // Should consume 225 units (100 * 2.25)
    assertEq(remainingAfterThird, 1525 * 1e18); // 1750 - 225

    FoundryCraftingCountData memory craftingData = FoundryCraftingCount.get(bytes32(foundryHash));
    assertEq(craftingData.count, 3);
    vm.stopPrank();
  }

  function testCraftSpaceship_RevertIfNotOwner() public {
    vm.prank(user2); // Different user
    MaterialType[] memory materials = new MaterialType[](2);
    materials[0] = MaterialType.WINDSTEEL;
    materials[1] = MaterialType.AURORIUM;
    uint256[] memory amounts = new uint256[](2);
    amounts[0] = 100 * 1e18;
    amounts[1] = 50 * 1e18;

    vm.expectRevert(Errors.NotPlanetOwner.selector);
    foundryCraftingSystem.craftSpaceship(foundryHash, 1, materials, amounts, Biome.OCEAN);
  }

  function testCraftSpaceship_RevertIfNotFoundry() public {
    vm.startPrank(admin);
    uint256 regularPlanetHash = 999;
    IWorld(worldAddress).df__createPlanet(
      regularPlanetHash,
      user1,
      0,
      4,
      PlanetType.PLANET, // Not a foundry
      SpaceType.NEBULA,
      300000,
      10000,
      0
    );
    vm.stopPrank();

    vm.prank(user1);
    MaterialType[] memory materials = new MaterialType[](2);
    materials[0] = MaterialType.WINDSTEEL;
    materials[1] = MaterialType.AURORIUM;
    uint256[] memory amounts = new uint256[](2);
    amounts[0] = 100 * 1e18;
    amounts[1] = 50 * 1e18;

    vm.expectRevert(Errors.InvalidPlanetType.selector);
    foundryCraftingSystem.craftSpaceship(regularPlanetHash, 1, materials, amounts, Biome.OCEAN);
  }

  function testCraftSpaceship_RevertIfLevelTooLow() public {
    vm.startPrank(admin);
    uint256 lowLevelFoundryHash = 888;
    IWorld(worldAddress).df__createPlanet(
      lowLevelFoundryHash,
      user1,
      0,
      3, // Level 3 (below minimum of 4)
      PlanetType.FOUNDRY,
      SpaceType.NEBULA,
      300000,
      10000,
      0
    );
    vm.stopPrank();

    vm.prank(user1);
    MaterialType[] memory materials = new MaterialType[](2);
    materials[0] = MaterialType.WINDSTEEL;
    materials[1] = MaterialType.AURORIUM;
    uint256[] memory amounts = new uint256[](2);
    amounts[0] = 100 * 1e18;
    amounts[1] = 50 * 1e18;

    vm.expectRevert(Errors.PlanetLevelTooLow.selector);
    foundryCraftingSystem.craftSpaceship(lowLevelFoundryHash, 1, materials, amounts, Biome.OCEAN);
  }

  function testCraftSpaceship_RevertIfInsufficientMaterials() public {
    vm.prank(user1);
    MaterialType[] memory materials = new MaterialType[](2);
    materials[0] = MaterialType.WINDSTEEL;
    materials[1] = MaterialType.AURORIUM;
    uint256[] memory amounts = new uint256[](2);
    amounts[0] = 2000 * 1e18; // More than available (1000)

    vm.expectRevert(Errors.InsufficientMaterialOnPlanet.selector);
    foundryCraftingSystem.craftSpaceship(foundryHash, 1, materials, amounts, Biome.OCEAN);
  }

  function testCraftSpaceship_RevertIfCraftingLimitReached() public {
    vm.startPrank(admin);
    // Add enough materials for 3 crafts
    IWorld(worldAddress).df__addMaterial(foundryHash, MaterialType.WINDSTEEL, 10000 * 1e18);
    IWorld(worldAddress).df__addMaterial(foundryHash, MaterialType.AURORIUM, 10000 * 1e18);
    vm.stopPrank();

    vm.startPrank(user1);
    MaterialType[] memory materials = new MaterialType[](2);
    materials[0] = MaterialType.WINDSTEEL;
    materials[1] = MaterialType.AURORIUM;
    uint256[] memory amounts = new uint256[](2);
    amounts[0] = 100 * 1e18;
    amounts[1] = 50 * 1e18;

    // Craft 3 times (max limit)
    for (uint256 i = 0; i < 3; i++) {
      foundryCraftingSystem.craftSpaceship(
        foundryHash,
        1, // Scout
        materials,
        amounts,
        Biome.OCEAN
      );
    }

    // Try to craft 4th time - should revert
    vm.expectRevert(Errors.FoundryCraftingLimitReached.selector);
    foundryCraftingSystem.craftSpaceship(foundryHash, 1, materials, amounts, Biome.OCEAN);
    vm.stopPrank();
  }

  function testCraftSpaceship_BonusCalculation() public {
    vm.prank(user1);
    MaterialType[] memory materials = new MaterialType[](2);
    materials[0] = MaterialType.WINDSTEEL;
    materials[1] = MaterialType.AURORIUM;
    uint256[] memory amounts = new uint256[](2);
    amounts[0] = 100 * 1e18;
    amounts[1] = 50 * 1e18;

    foundryCraftingSystem.craftSpaceship(
      foundryHash,
      1, // Scout - has speed and range bonuses
      materials,
      amounts,
      Biome.OCEAN
    );

    Planet memory foundry = IWorld(worldAddress).df__readPlanet(foundryHash);
    uint256 artifacts = PlanetArtifact.getArtifacts(bytes32(foundryHash));
    uint32 artifactId = uint32(artifacts & type(uint32).max); // Extract first artifact ID

    // Check bonuses were set
    SpaceshipBonusData memory bonuses = SpaceshipBonus.get(artifactId);
    // Scout has speed bonus (10) and range bonus (5)
    assertGt(bonuses.speedBonus, 0);
    assertGt(bonuses.rangeBonus, 0);
    // Scout has no attack bonus
    assertEq(bonuses.attackBonus, 0);
  }

  function testCraftSpaceship_DestroyerBonusCalculation() public {
    vm.startPrank(admin);
    // Add Destroyer materials
    IWorld(worldAddress).df__addMaterial(foundryHash, MaterialType.BLACKALLOY, 1000 * 1e18);
    IWorld(worldAddress).df__addMaterial(foundryHash, MaterialType.CORRUPTED_CRYSTAL, 1000 * 1e18);
    vm.stopPrank();

    vm.prank(user1);
    MaterialType[] memory materials = new MaterialType[](2);
    materials[0] = MaterialType.BLACKALLOY;
    materials[1] = MaterialType.CORRUPTED_CRYSTAL;
    uint256[] memory amounts = new uint256[](2);
    amounts[0] = 200 * 1e18;
    amounts[1] = 100 * 1e18;

    foundryCraftingSystem.craftSpaceship(
      foundryHash,
      3, // Destroyer - has attack and defense bonuses, no range bonus
      materials,
      amounts,
      Biome.OCEAN
    );

    Planet memory foundry = IWorld(worldAddress).df__readPlanet(foundryHash);
    uint256 artifacts = PlanetArtifact.getArtifacts(bytes32(foundryHash));
    uint32 artifactId = uint32(artifacts & type(uint32).max); // Extract first artifact ID

    SpaceshipBonusData memory bonuses = SpaceshipBonus.get(artifactId);
    // Destroyer has attack bonus (10) and defense bonus (10)
    assertGt(bonuses.attackBonus, 0);
    assertGt(bonuses.defenseBonus, 0);
    // Destroyer has no range bonus
    assertEq(bonuses.rangeBonus, 0);
  }

  function testGetFoundryCraftingCount() public {
    vm.prank(user1);
    MaterialType[] memory materials = new MaterialType[](1);
    materials[0] = MaterialType(1);
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = 100 * 1e18;

    // Initial count should be 0
    (uint8 count, uint64 lastCraftTime) = foundryCraftingSystem.getFoundryCraftingCount(foundryHash);
    assertEq(count, 0);
    assertEq(lastCraftTime, 0);

    // Craft once
    foundryCraftingSystem.craftSpaceship(foundryHash, 1, materials, amounts, Biome.OCEAN);

    // Count should be 1
    (count, lastCraftTime) = foundryCraftingSystem.getFoundryCraftingCount(foundryHash);
    assertEq(count, 1);
    assertGt(lastCraftTime, 0);
  }

  function testGetCraftingMultiplier() public {
    vm.prank(user1);
    MaterialType[] memory materials = new MaterialType[](1);
    materials[0] = MaterialType(1);
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = 100 * 1e18;

    // Initial multiplier should be 100 (1.0x)
    uint256 multiplier = foundryCraftingSystem.getCraftingMultiplier(foundryHash);
    assertEq(multiplier, 100);

    // Craft once - multiplier should be 150 (1.5x)
    foundryCraftingSystem.craftSpaceship(foundryHash, 1, materials, amounts, Biome.OCEAN);
    multiplier = foundryCraftingSystem.getCraftingMultiplier(foundryHash);
    assertEq(multiplier, 150);

    // Craft again - multiplier should be 225 (2.25x)
    foundryCraftingSystem.craftSpaceship(foundryHash, 2, materials, amounts, Biome.OCEAN);
    multiplier = foundryCraftingSystem.getCraftingMultiplier(foundryHash);
    assertEq(multiplier, 225);
  }
}
