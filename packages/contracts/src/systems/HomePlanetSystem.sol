// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

import { BaseSystem } from "systems/internal/BaseSystem.sol";
import { Planet, PlanetLib } from "libraries/Planet.sol";
import { DFUtils } from "libraries/DFUtils.sol";
import { PlanetType, SpaceType, Biome } from "codegen/common.sol";
import { PlanetOwner } from "codegen/tables/PlanetOwner.sol";
import { Ticker } from "codegen/tables/Ticker.sol";
import { HomePlanet, HomePlanetData } from "codegen/tables/HomePlanet.sol";
import { LastHomeChange } from "codegen/tables/LastHomeChange.sol";
import { StakedLevel } from "codegen/tables/StakedLevel.sol";
import { StakedPlanet, StakedPlanetData } from "codegen/tables/StakedPlanet.sol";
import { StakedPlanetByPlayer } from "codegen/tables/StakedPlanetByPlayer.sol";
import { PlanetToken as PlanetTokenTable } from "codegen/tables/PlanetToken.sol";
import { PlanetConstants } from "codegen/tables/PlanetConstants.sol";
import { Planet as PlanetTable } from "codegen/tables/Planet.sol";
import { PlanetInitialResource, PlanetInitialResourceData } from "codegen/tables/PlanetInitialResource.sol";
import { PlanetJunkOwner } from "codegen/tables/PlanetJunkOwner.sol";
import { PlayerJunk } from "codegen/tables/PlayerJunk.sol";
import { PlayerJunkLimit } from "codegen/tables/PlayerJunkLimit.sol";
import { JunkConfig } from "codegen/tables/JunkConfig.sol";
import { RevealedPlanet } from "codegen/tables/RevealedPlanet.sol";
import { IPlanetToken } from "../tokens/IPlanetToken.sol";
import { Errors } from "interfaces/errors.sol";
import { EntryFee } from "codegen/tables/EntryFee.sol";

contract HomePlanetSystem is BaseSystem {
  uint256 private constant COOLDOWN_TICKS = 4 * 60 * 60; // 4 hours in ticks (assuming 1 tick = 1 second)
  // ERC721: Each token is unique, so we transfer the specific tokenId (not an amount)

  /**
   * @notice Set a planet as your home planet (required before staking other planets)
   * @param planetHash The planet hash to set as home planet
   */
  function setHomePlanet(uint256 planetHash) public entryFee requireSameOwnerAndJunkOwner(planetHash) {
    address worldAddress = _world();
    DFUtils.tick(worldAddress);

    Planet memory planet = DFUtils.readInitedPlanet(worldAddress, planetHash);

    // Validate planet
    if (planet.owner != _msgSender()) revert Errors.NotPlanetOwner();
    if (planet.planetType != PlanetType.PLANET) revert Errors.InvalidPlanetType();

    // Check if player already has a home planet
    HomePlanetData memory existingHome = HomePlanet.get(_msgSender());
    if (existingHome.planetHash != bytes32(0)) {
      revert Errors.HomePlanetAlreadySet();
    }

    // Record home planet
    uint64 currentTick = Ticker.getTickNumber();
    HomePlanet.set(_msgSender(), bytes32(planetHash), currentTick);

    planet.writeToStore();
  }

  /**
   * @notice Change home planet (with 4h cooldown and fee in ETH based on planet.level and planet.spaceType)
   * @param newPlanetHash The new planet hash to set as home planet
   */
  function changeHomePlanet(uint256 newPlanetHash) public payable entryFee requireSameOwnerAndJunkOwner(newPlanetHash) {
    address worldAddress = _world();
    DFUtils.tick(worldAddress);

    // Check cooldown and get current home planet
    bytes32 currentHomeHash;
    uint64 currentTick;
    {
      uint64 lastChange = LastHomeChange.get(_msgSender());
      currentTick = Ticker.getTickNumber();
      if (lastChange > 0 && currentTick < lastChange + uint64(COOLDOWN_TICKS)) {
        revert Errors.HomePlanetChangeCooldown();
      }
      HomePlanetData memory currentHome = HomePlanet.get(_msgSender());
      if (currentHome.planetHash == bytes32(0)) {
        revert Errors.NoHomePlanet();
      }
      currentHomeHash = currentHome.planetHash;
    }

    // Validate new planet and calculate fee
    uint256 requiredValue;
    {
      Planet memory newPlanet = DFUtils.readInitedPlanet(worldAddress, newPlanetHash);
      if (newPlanet.owner != _msgSender()) revert Errors.NotPlanetOwner();
      if (newPlanet.planetType != PlanetType.PLANET) revert Errors.InvalidPlanetType();
      uint256 fee = _calculateChangeFee(newPlanet);
      requiredValue = EntryFee.getFee() + fee;
      if (msg.value < requiredValue) {
        revert Errors.InsufficientFee();
      }
      // Write new planet to store
      newPlanet.writeToStore();
    }

    // Update home planet and last change time
    HomePlanet.set(_msgSender(), bytes32(newPlanetHash), currentTick);
    LastHomeChange.set(_msgSender(), currentTick);

    // Refund excess ETH if any
    if (msg.value > requiredValue) {
      payable(_msgSender()).transfer(msg.value - requiredValue);
    }

    // Write old planet to store
    {
      Planet memory oldPlanet = DFUtils.readInitedPlanet(worldAddress, uint256(currentHomeHash));
      oldPlanet.writeToStore();
    }
  }

  /**
   * @notice Stake ERC721 NFT token to create a new planet (similar to starbase creation)
   * @param planetHash Hash of the new planet to create
   * @param perlin Perlin value for the planet
   * @param level Planet level (from ERC721 token metadata)
   * @param spaceType Space type for the planet
   * @param biome Biome for the planet
   * @param tokenId Token ID from PlanetToken NFT
   * @param x X coordinate for planet reveal
   * @param y Y coordinate for planet reveal
   * @dev Creates a new PlanetType.PLANET (type 0) entity in the game, similar to starbase creation
   *      Tokens must be minted externally first. This function transfers the NFT from user to contract.
   */
  function stakeTokens(
    uint256 planetHash,
    uint8 perlin,
    uint8 level,
    SpaceType spaceType,
    Biome biome,
    uint256 tokenId,
    int256 x,
    int256 y
  ) public entryFee {
    address worldAddress = _world();
    DFUtils.tick(worldAddress);

    // Validate staking prerequisites
    _validateStakingPrerequisites(worldAddress, planetHash, tokenId, level);

    // Transfer token first
    _transferTokenForStaking(_msgSender(), tokenId);

    // Create planet and reveal
    _createAndRevealPlanet(planetHash, _msgSender(), perlin, level, spaceType, biome, x, y);

    // Update tracking
    _updateStakingTracking(planetHash, _msgSender(), tokenId);
  }

  /**
   * @notice Unstake a planet created from ERC721 NFT token (removes planet, returns NFT)
   * @param planetHash Hash of the planet to unstake
   * @dev Removes the planet entity and returns the staked NFT to the player
   */
  function unstakePlanet(uint256 planetHash) public entryFee {
    address worldAddress = _world();
    DFUtils.tick(worldAddress);

    // Get staked planet data
    StakedPlanetData memory stakedPlanet = StakedPlanet.get(bytes32(planetHash));
    if (stakedPlanet.player != _msgSender()) {
      revert Errors.NotPlanetOwner();
    }

    // Get planet to verify ownership
    Planet memory planet = DFUtils.readInitedPlanet(worldAddress, planetHash);
    if (planet.owner != _msgSender()) {
      revert Errors.NotPlanetOwner();
    }

    // Get planet token contract
    IPlanetToken planetToken = IPlanetToken(PlanetTokenTable.get());

    // Transfer NFT back to user (ERC721)
    uint256 tokenId = stakedPlanet.tokenId;
    planetToken.safeTransferFrom(address(this), _msgSender(), tokenId);

    // Remove planet entity (clear tables)
    // Note: In practice, you might want to keep planet data but mark it as unstaked
    // For now, we'll just remove the staking record
    StakedPlanet.deleteRecord(bytes32(planetHash));
    // Note: StakedPlanetByPlayer.deleteRecord() will work after codegen regeneration
    // StakedPlanetByPlayer.deleteRecord(_msgSender(), bytes32(planetHash));

    // Update staked level (decrement count)
    uint256 currentStakedLevel = StakedLevel.get(_msgSender());
    StakedLevel.set(_msgSender(), currentStakedLevel - 1);
  }

  /**
   * @notice Get staking capacity for a player (based on home planet level)
   * @return maxPlanets Maximum number of planets that can be created (bounded by home planet level)
   */
  function getStakingCapacity(address player) public view returns (uint256 maxPlanets) {
    HomePlanetData memory homePlanet = HomePlanet.get(player);
    if (homePlanet.planetHash == bytes32(0)) {
      return 0; // No home planet = no staking capacity
    }

    address worldAddress = _world();
    Planet memory homePlanetObj = DFUtils.readInitedPlanet(worldAddress, uint256(homePlanet.planetHash));
    return uint256(homePlanetObj.level);
  }

  /**
   * @notice Get number of planets currently created from staked tokens
   */
  function getStakedLevel(address player) public view returns (uint256) {
    return StakedLevel.get(player);
  }

  /**
   * @notice Get list of planet hashes created from staked tokens
   * @dev This is a simplified version. In practice, you'd iterate through StakedPlanetByPlayer
   */
  function getStakedPlanets(address player) public view returns (bytes32[] memory) {
    // TODO: Implement iteration through StakedPlanetByPlayer table
    // For now, return empty array
    return new bytes32[](0);
  }

  /**
   * @notice Get player's home planet
   */
  function getHomePlanet(address player) public view returns (bytes32 planetHash, uint64 setAt) {
    HomePlanetData memory home = HomePlanet.get(player);
    return (home.planetHash, home.setAt);
  }

  /**
   * @notice Check if player can change home planet
   */
  function canChangeHomePlanet(address player) public view returns (bool) {
    uint64 lastChange = LastHomeChange.get(player);
    if (lastChange == 0) return true; // Never changed, can change

    uint64 currentTick = Ticker.getTickNumber();
    return currentTick >= lastChange + uint64(COOLDOWN_TICKS);
  }

  // ============ Internal Functions ============

  /**
   * @notice Validate home planet and return its level
   */
  function _validateHomePlanetForStaking(address worldAddress) internal view returns (uint8) {
    HomePlanetData memory homePlanet = HomePlanet.get(_msgSender());
    if (homePlanet.planetHash == bytes32(0)) {
      revert Errors.NoHomePlanet();
    }

    Planet memory homePlanetObj = DFUtils.readInitedPlanet(worldAddress, uint256(homePlanet.planetHash));
    if (homePlanetObj.owner != _msgSender()) {
      revert Errors.HomePlanetNotOwned();
    }

    return uint8(homePlanetObj.level);
  }

  /**
   * @notice Validate token for staking
   */
  function _validateTokenForStaking(uint256 tokenId, uint8 level) internal view returns (IPlanetToken) {
    IPlanetToken planetToken = IPlanetToken(PlanetTokenTable.get());

    // Verify token level matches
    uint8 tokenLevel = planetToken.getTokenLevel(tokenId);
    if (tokenLevel != level) revert Errors.InvalidTokenLevel();

    // Check user owns the token (ERC721)
    if (planetToken.ownerOf(tokenId) != _msgSender()) {
      revert Errors.NotTokenOwner();
    }

    return planetToken;
  }

  /**
   * @notice Check and update staking capacity
   */
  function _checkAndUpdateStakingCapacity(uint8 homePlanetLevel) internal {
    uint256 currentStakedLevel = StakedLevel.get(_msgSender());
    uint256 maxStakingLevel = uint256(homePlanetLevel);

    if (currentStakedLevel + 1 > maxStakingLevel) {
      revert Errors.StakingCapacityExceeded(maxStakingLevel - currentStakedLevel);
    }

    // Update staked level (count of planets created)
    StakedLevel.set(_msgSender(), currentStakedLevel + 1);
  }

  /**
   * @notice Validate staking prerequisites (home planet, planet existence, token)
   */
  function _validateStakingPrerequisites(
    address worldAddress,
    uint256 planetHash,
    uint256 tokenId,
    uint8 level
  ) internal view {
    // Validate and get home planet
    uint8 homePlanetLevel = _validateHomePlanetForStaking(worldAddress);

    // Validate planet doesn't already exist
    if (_planetExists(planetHash)) revert Errors.InvalidPlanetHash();

    // Get planet token contract and validate
    _validateTokenForStaking(tokenId, level);

    // Check staking capacity (but don't update yet - do it in execute)
    {
      uint256 currentStakedLevel = StakedLevel.get(_msgSender());
      uint256 maxStakingLevel = uint256(homePlanetLevel);
      if (currentStakedLevel + 1 > maxStakingLevel) {
        revert Errors.StakingCapacityExceeded(maxStakingLevel - currentStakedLevel);
      }
    }
  }

  /**
   * @notice Transfer token for staking
   */
  function _transferTokenForStaking(address player, uint256 tokenId) internal {
    IPlanetToken planetToken = IPlanetToken(PlanetTokenTable.get());
    planetToken.safeTransferFrom(player, address(this), tokenId);
  }

  /**
   * @notice Update staking tracking
   */
  function _updateStakingTracking(uint256 planetHash, address player, uint256 tokenId) internal {
    uint256 currentStakedLevel = StakedLevel.get(player);
    StakedLevel.set(player, currentStakedLevel + 1);
    _recordStakedPlanet(planetHash, player, tokenId);
  }

  /**
   * @notice Record staked planet in tables
   */
  function _recordStakedPlanet(uint256 planetHash, address player, uint256 tokenId) internal {
    uint64 currentTick = Ticker.getTickNumber();
    StakedPlanet.set(bytes32(planetHash), player, tokenId, currentTick);
    // Note: StakedPlanetByPlayer.set() will work after codegen regeneration
    // For now, we can query StakedPlanet by player field instead
    // StakedPlanetByPlayer.set(player, bytes32(planetHash), true);
  }

  /**
   * @notice Create planet entity and reveal coordinates (combined to reduce stack depth)
   */
  function _createAndRevealPlanet(
    uint256 planetHash,
    address owner,
    uint8 perlin,
    uint8 level,
    SpaceType spaceType,
    Biome biome,
    int256 x,
    int256 y
  ) internal {
    _createPlanetFromToken(planetHash, owner, perlin, level, spaceType, biome);
    RevealedPlanet.set(bytes32(planetHash), int32(x), int32(y), owner);
  }

  /**
   * @notice Create a planet entity from staked ERC721 NFT token (similar to starbase creation)
   * @param planetHash Hash of the planet to create
   * @param owner Owner of the planet
   * @param perlin Perlin value for the planet
   * @param level Planet level (from token metadata)
   * @param spaceType Space type for the planet
   * @param biome Biome for the planet
   * @dev Creates a PlanetType.PLANET (type 0) entity, similar to how starbases are created
   */
  function _createPlanetFromToken(
    uint256 planetHash,
    address owner,
    uint8 perlin,
    uint8 level,
    SpaceType spaceType,
    Biome biome
  ) internal {
    address worldAddress = _world();
    bytes32 planetHashBytes = bytes32(planetHash);

    // Create planet constants and set owner
    PlanetConstants.set(planetHashBytes, perlin, level, PlanetType.PLANET, spaceType);
    PlanetOwner.set(planetHashBytes, owner);
    setPlanetJunkOwner(planetHash, owner, level);

    // Get initial population and initialize planet
    {
      PlanetInitialResourceData memory initialResources = PlanetInitialResource.get(
        spaceType,
        PlanetType.PLANET,
        level
      );
      PlanetTable.set(
        planetHashBytes,
        Ticker.getTickNumber(),
        initialResources.population,
        0, // Silver starts at 0
        0, // No upgrades initially
        false // useProps = false (use metadata, not props)
      );
    }

    // Sync planet to current tick and ensure all internal structures are initialized
    {
      Planet memory planet = DFUtils.readInitedPlanet(worldAddress, planetHash);
      planet.writeToStore();
    }
  }

  /**
   * @notice Set planet junk owner (helper function, same pattern as TestOnlySystem)
   */
  function setPlanetJunkOwner(uint256 planetHash, address junkOwner, uint256 level) internal {
    PlanetJunkOwner.set(bytes32(planetHash), junkOwner);
    uint256[] memory PLANET_LEVEL_JUNK = JunkConfig.getPLANET_LEVEL_JUNK();
    uint256 planetJunk = PLANET_LEVEL_JUNK[level];
    uint256 playerJunk = PlayerJunk.get(junkOwner);
    uint256 playerJunkLimit = PlayerJunkLimit.get(junkOwner);
    PlayerJunk.set(junkOwner, playerJunk + planetJunk);
  }

  /**
   * @notice Check if planet exists
   */
  function _planetExists(uint256 planetHash) internal view returns (bool) {
    return PlanetConstants.get(bytes32(planetHash)).level > 0;
  }

  /**
   * @notice Calculate fee for changing home planet (in wei)
   * Fee is based on planet.level and planet.spaceType
   */
  function _calculateChangeFee(Planet memory planet) internal pure returns (uint256) {
    uint256 baseFee = 0.01 ether; // Base fee in ETH

    // Level multiplier (higher level = higher fee)
    uint256 levelMultiplier = 100 + (uint256(planet.level) * 15); // 100% + 15% per level

    // SpaceType multiplier
    uint256 spaceTypeMultiplier = _getSpaceTypeMultiplier(planet.spaceType);

    uint256 totalMultiplier = (levelMultiplier * spaceTypeMultiplier) / (100 * 100);

    return (baseFee * totalMultiplier) / 100;
  }

  /**
   * @notice Get space type multiplier for fee calculation
   */
  function _getSpaceTypeMultiplier(SpaceType spaceType) internal pure returns (uint256) {
    // NEBULA: 100%, SPACE: 110%, DEEP_SPACE: 130%, DEAD_SPACE: 150%
    if (spaceType == SpaceType.NEBULA) return 100;
    if (spaceType == SpaceType.SPACE) return 110;
    if (spaceType == SpaceType.DEEP_SPACE) return 130;
    if (spaceType == SpaceType.DEAD_SPACE) return 150;
    return 100;
  }
}
