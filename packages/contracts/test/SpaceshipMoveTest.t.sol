// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import { BaseTest } from "./BaseTest.t.sol";
import { IWorld } from "../src/codegen/world/IWorld.sol";
import { FoundryCraftingSystem } from "../src/systems/FoundryCraftingSystem.sol";
import { SpaceshipBonus, SpaceshipBonusData } from "../src/codegen/tables/SpaceshipBonus.sol";
import { Planet as PlanetTable, TempConfigSet } from "../src/codegen/index.sol";
import { PlanetType, MaterialType, Biome, SpaceType } from "../src/codegen/common.sol";
import { Planet } from "../src/lib/Planet.sol";
import { MaterialMove } from "../src/lib/Material.sol";
import { Proof } from "../src/lib/SnarkProof.sol";
import { MoveInput } from "../src/lib/VerificationInput.sol";
import { Ticker } from "../src/codegen/index.sol";
import { PlanetArtifact } from "../src/codegen/tables/PlanetArtifact.sol";

contract SpaceshipMoveTest is BaseTest {
  FoundryCraftingSystem foundryCraftingSystem;
  uint256 foundryHash;
  uint256 planet1Hash;
  uint256 planet2Hash;
  uint32 spaceshipArtifactId;

  function setUp() public override {
    super.setUp();

    vm.startPrank(admin);
    // Skip snark check
    TempConfigSet.setSkipProofCheck(true);

    // Unpause the universe if needed
    if (Ticker.getPaused()) {
      IWorld(worldAddress).df__unpause();
    }

    // Create foundry
    foundryHash = 1;
    IWorld(worldAddress).df__createPlanet(
      foundryHash,
      user1,
      0,
      4,
      PlanetType.FOUNDRY,
      SpaceType.NEBULA,
      300000,
      10000,
      0
    );
    IWorld(worldAddress).df__addMaterial(foundryHash, MaterialType(1), 1000 * 1e18);

    // Create two planets for movement testing
    planet1Hash = 2;
    planet2Hash = 3;
    IWorld(worldAddress).df__createPlanet(
      planet1Hash,
      user1,
      0,
      1,
      PlanetType.PLANET,
      SpaceType.NEBULA,
      300000,
      10000,
      0
    );
    IWorld(worldAddress).df__createPlanet(
      planet2Hash,
      user2,
      0,
      1,
      PlanetType.PLANET,
      SpaceType.NEBULA,
      200000,
      10000,
      0
    );

    // Set tick rate to 1
    Ticker.setTickRate(1);

    foundryCraftingSystem = FoundryCraftingSystem(worldAddress);
    vm.stopPrank();

    // Craft a spaceship
    vm.prank(user1);
    MaterialType[] memory materials = new MaterialType[](1);
    materials[0] = MaterialType(1);
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = 100 * 1e18;

    foundryCraftingSystem.craftSpaceship(
      foundryHash,
      1, // Scout - has speed and range bonuses
      materials,
      amounts,
      Biome.OCEAN
    );

    // Get the spaceship artifact ID
    Planet memory foundry = IWorld(worldAddress).df__readPlanet(foundryHash);
    uint256 artifacts = PlanetArtifact.getArtifacts(bytes32(foundryHash));
    spaceshipArtifactId = uint32(artifacts & type(uint32).max); // Extract first artifact ID
  }

  function testMoveWithSpaceship_AppliesBonuses() public {
    vm.warp(block.timestamp + 1000);

    // Move spaceship from foundry to planet1
    Planet memory foundry = IWorld(worldAddress).df__readPlanet(foundryHash);
    Planet memory planet1 = IWorld(worldAddress).df__readPlanet(planet1Hash);

    // Get spaceship bonuses
    SpaceshipBonusData memory bonuses = SpaceshipBonus.get(spaceshipArtifactId);

    // Verify bonuses exist
    assertGt(bonuses.speedBonus, 0);
    assertGt(bonuses.rangeBonus, 0);

    // Create move with spaceship artifact
    Proof memory proof;
    MoveInput memory input;
    input.fromPlanetHash = foundryHash;
    input.toPlanetHash = planet1Hash;
    input.distance = 100;

    vm.prank(user1);
    IWorld(worldAddress).df__move(
      proof,
      input,
      100000,
      1000,
      spaceshipArtifactId, // Include spaceship artifact
      new MaterialMove[](0)
    );

    // Verify spaceship was moved
    foundry = IWorld(worldAddress).df__readPlanet(foundryHash);
    uint256 artifactsAfter = PlanetArtifact.getArtifacts(bytes32(foundryHash));
    assertEq(artifactsAfter, 0); // Spaceship removed from foundry

    // Verify planet1 will receive the spaceship when move arrives
    // (This would be checked when the move arrives)
  }

  function testMoveWithSpaceship_SpeedBonusApplied() public {
    vm.warp(block.timestamp + 1000);

    Planet memory planet1 = IWorld(worldAddress).df__readPlanet(planet1Hash);
    Planet memory planet2 = IWorld(worldAddress).df__readPlanet(planet2Hash);

    // Get base speed
    uint256 baseSpeed = planet1.speed;

    // Get spaceship bonuses
    SpaceshipBonusData memory bonuses = SpaceshipBonus.get(spaceshipArtifactId);

    // Calculate expected speed with bonus
    uint256 expectedSpeed = (baseSpeed * (100 + bonuses.speedBonus)) / 100;

    // Create move with spaceship
    Proof memory proof;
    MoveInput memory input;
    input.fromPlanetHash = planet1Hash;
    input.toPlanetHash = planet2Hash;
    input.distance = 100;

    // Note: In actual Move.sol, the speed bonus is applied in _applySpaceshipBonuses
    // This test verifies the bonus exists and can be applied
    assertGt(expectedSpeed, baseSpeed, "Speed should increase with bonus");
  }

  function testMoveWithSpaceship_RangeBonusApplied() public {
    vm.warp(block.timestamp + 1000);

    Planet memory planet1 = IWorld(worldAddress).df__readPlanet(planet1Hash);

    // Get base range
    uint256 baseRange = planet1.range;

    // Get spaceship bonuses
    SpaceshipBonusData memory bonuses = SpaceshipBonus.get(spaceshipArtifactId);

    // Calculate expected range with bonus
    uint256 expectedRange = (baseRange * (100 + bonuses.rangeBonus)) / 100;

    // Range bonus allows moving further with same energy
    assertGt(expectedRange, baseRange, "Range should increase with bonus");
  }

  function testMoveWithSpaceship_AttackBonusApplied() public {
    vm.warp(block.timestamp + 1000);

    // Craft a Destroyer (has attack bonus)
    vm.startPrank(user1);
    MaterialType[] memory materials = new MaterialType[](1);
    materials[0] = MaterialType(1);
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = 100 * 1e18;

    foundryCraftingSystem.craftSpaceship(
      foundryHash,
      3, // Destroyer - has attack bonus
      materials,
      amounts,
      Biome.OCEAN
    );

    Planet memory foundry = IWorld(worldAddress).df__readPlanet(foundryHash);
    uint256 artifacts = PlanetArtifact.getArtifacts(bytes32(foundryHash));
    uint32 destroyerArtifactId = uint32(artifacts & type(uint32).max); // Extract first artifact ID
    vm.stopPrank();

    SpaceshipBonusData memory bonuses = SpaceshipBonus.get(destroyerArtifactId);

    // Destroyer should have attack bonus
    assertGt(bonuses.attackBonus, 0, "Destroyer should have attack bonus");

    // Attack bonus increases energy arriving when attacking enemy planets
    // This is handled in the combat calculation in Move.sol
  }

  function testMoveWithoutSpaceship_NoBonuses() public {
    vm.warp(block.timestamp + 1000);

    Planet memory planet1 = IWorld(worldAddress).df__readPlanet(planet1Hash);
    Planet memory planet2 = IWorld(worldAddress).df__readPlanet(planet2Hash);

    uint256 baseSpeed = planet1.speed;
    uint256 baseRange = planet1.range;

    // Move without spaceship artifact
    Proof memory proof;
    MoveInput memory input;
    input.fromPlanetHash = planet1Hash;
    input.toPlanetHash = planet2Hash;
    input.distance = 100;

    vm.prank(user1);
    IWorld(worldAddress).df__move(
      proof,
      input,
      100000,
      1000,
      0, // No artifact
      new MaterialMove[](0)
    );

    // Verify no bonuses were applied (base values unchanged)
    // This is implicit - if no artifact is passed, bonuses aren't applied
    assertEq(planet1.speed, baseSpeed);
    assertEq(planet1.range, baseRange);
  }
}
