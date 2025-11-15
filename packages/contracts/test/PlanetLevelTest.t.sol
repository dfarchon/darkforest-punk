// SPDX-License-Identifier: MIT
pragma solidity >=0.8.24;

import "forge-std/Test.sol";
import { BaseTest } from "./BaseTest.t.sol";
import { IWorld } from "../src/codegen/world/IWorld.sol";
import { Planet } from "../src/lib/Planet.sol";
import { PlanetType, SpaceType } from "../src/codegen/common.sol";
import { Errors } from "../src/interfaces/errors.sol";
import { Proof } from "../src/lib/SnarkProof.sol";
import { RevealInput } from "../src/lib/VerificationInput.sol";
import { Ticker, TempConfigSet } from "../src/codegen/index.sol";
import { SpaceTypeConfig } from "../src/codegen/tables/SpaceTypeConfig.sol";
import { PlanetLevelConfig } from "../src/codegen/tables/PlanetLevelConfig.sol";
import { UniverseZoneConfig } from "../src/codegen/tables/UniverseZoneConfig.sol";

/**
 * @title PlanetLevelTest
 * @notice Tests planet initialization and min/max level enforcement for DEEP_SPACE and DEAD_SPACE
 */
contract PlanetLevelTest is BaseTest {
  uint256 p = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
  uint256 revealCd = 100;

  function setUp() public virtual override {
    super.setUp();
    vm.startPrank(admin);
    IWorld(worldAddress).df__unpause();
    TempConfigSet.setRevealCd(uint32(revealCd));
    // skip snark check for testing
    TempConfigSet.setSkipProofCheck(true);
    vm.stopPrank();
  }

  /**
   * @notice Helper function to create a planet hash that results in a specific level
   * @param targetLevel The target level (before bonuses)
   * @return planetHash A hash that will result in the target level
   */
  function _createPlanetHashForLevel(uint8 targetLevel) internal view returns (uint256) {
    uint32[] memory thresholds = PlanetLevelConfig.getThresholds();
    uint256 maxLvl = thresholds.length;

    // Calculate which threshold range we need
    // Level = maxLvl - i, so i = maxLvl - level
    uint256 thresholdIndex = maxLvl - targetLevel;

    // Return a hash value that falls in the middle of the threshold range
    if (thresholdIndex == 0) {
      // For highest level, use a value just below first threshold
      return thresholds[0] - 1;
    } else if (thresholdIndex >= thresholds.length) {
      // For level 0, use a value above all thresholds
      return thresholds[thresholds.length - 1] + 1000;
    } else {
      // Use a value between thresholds[thresholdIndex-1] and thresholds[thresholdIndex]
      uint32 lowerBound = thresholdIndex > 0 ? thresholds[thresholdIndex - 1] : 0;
      uint32 upperBound = thresholds[thresholdIndex];
      return (lowerBound + upperBound) / 2;
    }
  }

  /**
   * @notice Helper function to create a planet hash with a specific first 24 bits
   */
  function _createPlanetHashWithValue(uint256 value) internal pure returns (uint256) {
    // Ensure value fits in 24 bits
    require(value < 2 ** 24, "Value too large for 24 bits");
    // Create a hash with the value in the first 24 bits
    return value;
  }

  /**
   * @notice Helper function to get perlin value for a specific space type
   * @param spaceType The space type
   * @return perlin A perlin value that results in the space type
   */
  function _getPerlinForSpaceType(SpaceType spaceType) internal view returns (uint8) {
    uint32[] memory perlinThresholds = SpaceTypeConfig.getPerlinThresholds();

    if (spaceType == SpaceType.NEBULA) {
      return uint8(perlinThresholds[0] - 1);
    } else if (spaceType == SpaceType.SPACE) {
      return uint8((perlinThresholds[0] + perlinThresholds[1]) / 2);
    } else if (spaceType == SpaceType.DEEP_SPACE) {
      return uint8((perlinThresholds[1] + perlinThresholds[2]) / 2);
    } else if (spaceType == SpaceType.DEAD_SPACE) {
      return uint8(perlinThresholds[2] + 1);
    }
    revert("Unknown space type");
  }

  /**
   * @notice Test that config values are correctly set
   */
  function testConfigValues() public view {
    uint8[] memory minLimits = SpaceTypeConfig.getPlanetLevelMinLimits();
    uint8[] memory maxLimits = SpaceTypeConfig.getPlanetLevelLimits();

    // Verify DEEP_SPACE (index 2) has min level 3
    assertEq(minLimits[2], 3, "DEEP_SPACE min level should be 3");
    // Verify DEAD_SPACE (index 3) has min level 3
    assertEq(minLimits[3], 3, "DEAD_SPACE min level should be 3");
    // Verify max limits are set
    assertEq(maxLimits[2], 9, "DEEP_SPACE max level should be 9");
    assertEq(maxLimits[3], 9, "DEAD_SPACE max level should be 9");
  }

  /**
   * @notice Test that planets with level 0-2 in DEEP_SPACE revert
   */
  function testDeepSpace_Level0Reverts() public {
    // Create a planet hash that would result in level 0
    uint256 planetHash = _createPlanetHashWithValue(1500001); // Above all thresholds = level 0
    uint8 perlin = _getPerlinForSpaceType(SpaceType.DEEP_SPACE);

    Proof memory proof;
    RevealInput memory input;
    input.planetHash = planetHash;
    input.perlin = perlin;
    input.x = p - 50000; // Deep space coordinates
    input.y = 50000;

    vm.expectRevert(Errors.InvalidPlanetHash.selector);
    IWorld(worldAddress).df__revealLocation(proof, input);
  }

  function testDeepSpace_Level1Reverts() public {
    // Level 1 = hash between 800000 and 1500000 (800000 <= hash < 1500000)
    // Use a value in this range
    uint256 planetHash = _createPlanetHashWithValue(1000000);
    uint8 perlin = _getPerlinForSpaceType(SpaceType.DEEP_SPACE);

    Proof memory proof;
    RevealInput memory input;
    input.planetHash = planetHash;
    input.perlin = perlin;
    input.x = p - 50000;
    input.y = 50000;

    vm.expectRevert(Errors.InvalidPlanetHash.selector);
    IWorld(worldAddress).df__revealLocation(proof, input);
  }

  function testDeepSpace_Level2Reverts() public {
    // Level 2 = hash between 300000 and 800000 (300000 <= hash < 800000)
    uint256 planetHash = _createPlanetHashWithValue(500000);
    uint8 perlin = _getPerlinForSpaceType(SpaceType.DEEP_SPACE);

    Proof memory proof;
    RevealInput memory input;
    input.planetHash = planetHash;
    input.perlin = perlin;
    input.x = p - 50000;
    input.y = 50000;

    vm.expectRevert(Errors.InvalidPlanetHash.selector);
    IWorld(worldAddress).df__revealLocation(proof, input);
  }

  /**
   * @notice Test that planets with level 3+ in DEEP_SPACE succeed
   */
  function testDeepSpace_Level3Succeeds() public {
    // Level 3 = hash between 70000 and 300000 (70000 <= hash < 300000)
    uint256 planetHash = _createPlanetHashWithValue(150000);
    uint8 perlin = _getPerlinForSpaceType(SpaceType.DEEP_SPACE);

    Proof memory proof;
    RevealInput memory input;
    input.planetHash = planetHash;
    input.perlin = perlin;
    input.x = p - 50000;
    input.y = 50000;

    IWorld(worldAddress).df__revealLocation(proof, input);

    Planet memory planet = IWorld(worldAddress).df__readPlanet(planetHash);
    assertEq(uint8(planet.spaceType), uint8(SpaceType.DEEP_SPACE), "Space type should be DEEP_SPACE");
    assertGe(uint8(planet.level), 3, "Level should be at least 3");
    assertLe(uint8(planet.level), 9, "Level should be at most 9");
  }

  /**
   * @notice Test that planets with level 0-2 in DEAD_SPACE revert
   */
  function testDeadSpace_Level0Reverts() public {
    uint256 planetHash = _createPlanetHashWithValue(1500001);
    uint8 perlin = _getPerlinForSpaceType(SpaceType.DEAD_SPACE);

    Proof memory proof;
    RevealInput memory input;
    input.planetHash = planetHash;
    input.perlin = perlin;
    input.x = p - 60000; // Dead space coordinates (further out)
    input.y = 60000;

    vm.expectRevert(Errors.InvalidPlanetHash.selector);
    IWorld(worldAddress).df__revealLocation(proof, input);
  }

  function testDeadSpace_Level1Reverts() public {
    // Level 1 = hash between 800000 and 1500000
    uint256 planetHash = _createPlanetHashWithValue(1000000);
    uint8 perlin = _getPerlinForSpaceType(SpaceType.DEAD_SPACE);

    Proof memory proof;
    RevealInput memory input;
    input.planetHash = planetHash;
    input.perlin = perlin;
    input.x = p - 60000;
    input.y = 60000;

    vm.expectRevert(Errors.InvalidPlanetHash.selector);
    IWorld(worldAddress).df__revealLocation(proof, input);
  }

  function testDeadSpace_Level2Reverts() public {
    // Level 2 = hash between 300000 and 800000
    uint256 planetHash = _createPlanetHashWithValue(500000);
    uint8 perlin = _getPerlinForSpaceType(SpaceType.DEAD_SPACE);

    Proof memory proof;
    RevealInput memory input;
    input.planetHash = planetHash;
    input.perlin = perlin;
    input.x = p - 60000;
    input.y = 60000;

    vm.expectRevert(Errors.InvalidPlanetHash.selector);
    IWorld(worldAddress).df__revealLocation(proof, input);
  }

  /**
   * @notice Test that planets with level 3+ in DEAD_SPACE succeed
   */
  function testDeadSpace_Level3Succeeds() public {
    // Level 3 = hash between 70000 and 300000
    uint256 planetHash = _createPlanetHashWithValue(150000);
    uint8 perlin = _getPerlinForSpaceType(SpaceType.DEAD_SPACE);

    Proof memory proof;
    RevealInput memory input;
    input.planetHash = planetHash;
    input.perlin = perlin;
    input.x = p - 60000;
    input.y = 60000;

    IWorld(worldAddress).df__revealLocation(proof, input);

    Planet memory planet = IWorld(worldAddress).df__readPlanet(planetHash);
    assertEq(uint8(planet.spaceType), uint8(SpaceType.DEAD_SPACE), "Space type should be DEAD_SPACE");
    assertGe(uint8(planet.level), 3, "Level should be at least 3");
    assertLe(uint8(planet.level), 9, "Level should be at most 9");
  }

  /**
   * @notice Test that planets in NEBULA and SPACE can have level 0-2
   */
  function testNebula_Level0Succeeds() public {
    uint256 planetHash = _createPlanetHashWithValue(1500001);
    uint8 perlin = _getPerlinForSpaceType(SpaceType.NEBULA);

    Proof memory proof;
    RevealInput memory input;
    input.planetHash = planetHash;
    input.perlin = perlin;
    input.x = 1000; // Nebula coordinates (close to origin)
    input.y = 1000;

    IWorld(worldAddress).df__revealLocation(proof, input);

    Planet memory planet = IWorld(worldAddress).df__readPlanet(planetHash);
    assertEq(uint8(planet.spaceType), uint8(SpaceType.NEBULA), "Space type should be NEBULA");
    // Level 0 is allowed in NEBULA
    assertLe(uint8(planet.level), 4, "Level should be at most 4 (NEBULA max)");
  }

  /**
   * @notice Test that max level is enforced (capped at 9 for DEEP_SPACE and DEAD_SPACE)
   */
  function testDeepSpace_MaxLevelEnforced() public {
    // Create a planet hash that would result in a very high level
    // Use a hash that's very low (would result in level 9)
    uint256 planetHash = _createPlanetHashWithValue(50); // Very low = high level
    uint8 perlin = _getPerlinForSpaceType(SpaceType.DEEP_SPACE);

    Proof memory proof;
    RevealInput memory input;
    input.planetHash = planetHash;
    input.perlin = perlin;
    input.x = p - 50000;
    input.y = 50000;

    IWorld(worldAddress).df__revealLocation(proof, input);

    Planet memory planet = IWorld(worldAddress).df__readPlanet(planetHash);
    assertEq(uint8(planet.spaceType), uint8(SpaceType.DEEP_SPACE), "Space type should be DEEP_SPACE");
    assertLe(uint8(planet.level), 9, "Level should be capped at 9");
  }

  /**
   * @notice Test multiple valid levels in DEEP_SPACE
   */
  function testDeepSpace_MultipleValidLevels() public {
    uint8 perlin = _getPerlinForSpaceType(SpaceType.DEEP_SPACE);
    Proof memory proof;

    // Test level 3 (hash between 70000 and 300000)
    uint256 hash3 = _createPlanetHashWithValue(150000);
    RevealInput memory input3;
    input3.planetHash = hash3;
    input3.perlin = perlin;
    input3.x = p - 50000;
    input3.y = 50000;
    IWorld(worldAddress).df__revealLocation(proof, input3);
    Planet memory planet3 = IWorld(worldAddress).df__readPlanet(hash3);
    assertGe(uint8(planet3.level), 3, "Level should be at least 3");

    // Test level 5 (hash between 35000 and 70000)
    uint256 hash5 = _createPlanetHashWithValue(50000);
    RevealInput memory input5;
    input5.planetHash = hash5;
    input5.perlin = perlin;
    input5.x = p - 50001;
    input5.y = 50001;
    IWorld(worldAddress).df__revealLocation(proof, input5);
    Planet memory planet5 = IWorld(worldAddress).df__readPlanet(hash5);
    assertGe(uint8(planet5.level), 3, "Level should be at least 3");

    // Test level 9 (hash < 100)
    uint256 hash9 = _createPlanetHashWithValue(50);
    RevealInput memory input9;
    input9.planetHash = hash9;
    input9.perlin = perlin;
    input9.x = p - 50002;
    input9.y = 50002;
    IWorld(worldAddress).df__revealLocation(proof, input9);
    Planet memory planet9 = IWorld(worldAddress).df__readPlanet(hash9);
    assertLe(uint8(planet9.level), 9, "Level should be at most 9");
    assertGe(uint8(planet9.level), 3, "Level should be at least 3");
  }
}
