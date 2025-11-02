// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.24;

interface Errors {
  // ex. error AlreadyRegistered's selector = bytes4(keccak256("AlreadyRegistered()"));
  // do cast sig "functionName()" in terminal to get the error selector // 0xd7d15059

  // player system
  error AlreadyRegistered(); // 0x3a81d6fc
  error NotRegistered(); // 0xaba47339
  error NameAlreadyTaken(); // 0x35c1bb34
  error BurnerAlreadyTaken(); // 0xd240a556
  error PlayerLimitReached(); // 0x7eed032c
  error AlreadyRegisteredAsBurner(); // 0xb7887dbe
  error AlreadySpawned(); // 0xb7298922
  error InvalidSpawnPlanet(); // 0x486b36b3
  error InvalidSpawnProof(); // 0x7cbbb34f

  // verify system
  error InvalidMoveProof(); // 0x217623c0
  error InvalidProofInput(uint8 index); // 255 for snark and perlin config, 0xde56fcb9

  // move system
  error NotPlanetOwner(); // 0xab2bcfd3
  error MoveToSamePlanet(); // 0xf13223e1
  error NotEnoughPopulation(); // 0xb4560519
  error NotEnoughPopulationToReach(); // 0x8c2529c4
  error NotEnoughSilver(); // 0xb973ef98
  error NotArtifactOwner(); // 0xa4c7eb90
  error ReachMaxMoveToLimit(uint8 limit); // 0x0edddad6
  error ArtifactStorageFull(); // 0xb3643b72
  error ArtifactNotOnPlanet(); // 0x37a29a4e
  error PlanetOwnershipMismatch(); //0xb43ec652
  error NotEnoughMaterial(); // 0x7b8217de
  error MoveNotFound(); // 0xf61e54c1
  error NotMoveCaptain(); // 0x747a000a
  error MoveTooFarToRevert(); // 0xc1a1a6ff
  error MoveAlreadyReverted(); // 0x9b48f541

  // tick system
  error Paused(); // 0x9e87fac8
  error NotPaused(); // 0x6cd60201

  // planet system
  error InvalidPlanetHash(); // 0xf4cf9e37
  error UnknownPlanetType(); // 0xa6fa3da7
  error InvalidUpgradeTarget(); // 0x0ec7b300
  error UpgradeExceedMaxLevel(); // 0x1d245dc9
  error NotEnoughSilverToUpgrade(); // 0x3c1137b2
  error PlanetNotAvailable(); // 0xa7d5125d
  error PlanetNotInitialized(); // 0xcfd4ee18
  error PlanetLevelTooLow(); // 0x504f5026

  // reveal system
  error InvalidRevealProof(); // 0x5d655004
  error RevealTooOften(); // 0xbdbe7784

  // artifact system
  error InvalidProspectTarget(); // 0x341e4b4d
  error PlanetAlreadyProspected(); // 0x56887924
  error InvalidBiomebaseProof(); // 0x128087c4
  error PlanetNotProspected(); // 0x9b8b75ee
  error PlanetAlreadyExplored(); // 0x46b8aa3d
  error UnkonwnArtifactType(); // 0xe5d5eab9
  error ArtifactNotAvailable(); // 0xc878be8d
  error ArtifactOnCooldown(); // 0x47e6b7ca
  error ArtifactNotChargeable(); // 0x342e603f
  error PlanetLevelMismatch(); // 0x3b366702
  error NotEnoughResourceToActivate(); // 0xe642b7b4
  error ExistingArtifact(); // 0x11f0e4e4
  error OnlyCallableByArtifactInstallModule(); // 0xbf9f6704
  error EffectNumberExceeded(); // 0x8c954681
  error ArtifactInUse(); // 0x1b996bf4
  error ArtifactIdOverflow(); // 0x0c491e00
  error ArtifactOutOfControl(); // 0xf90edd80
  error ArtifactRarityTooHigh(); // 0xaefde1a6
  error ArtifactWithdrawalDisabled(); // 0xed2ec822
  error FoundryCraftingLimitReached(); // 0x8396eb65
  error InvalidSpaceshipType(); // 0x51f065d2
  error InvalidMaterialAmount(); // 0xea7eae74
  error InvalidMaterialType(); // 0x69593a26
  error MissingRequiredMaterials(); // 0xe5774581
  error NotEnoughMaterial1(); // 0x53841e48
  // planet withdraw silver system
  error InvalidPlanetType(); // 0xcfb7f825
  error InsufficientSilverOnPlanet(); // 0xfe845fce
  error WithdrawAmountTooLow(); // 0xba43ea37

  // planet withdraw material system
  error InsufficientMaterialOnPlanet(); // 0xd3ed2932

  // planet junk systemAdd commentMore actions
  error SpaceJunkDisabled(); // 0x94486384
  error JunkLimitExceeded(); // 0x711da309
  error InvalidJunkOperation(); // 0xa94506f6
  error NotJunkOwner(); // 0x438f2b77
  error NotSameOwnerAndJunkOwner(); // 0x1ff3ce95
  error NeedFundsToBuySpaceJunk(); // 0x0df7541b
  error NeedBuyMore(); // 0x01f7d1e9
  error NeedBuyLess(); // 0x2c27494e

  // GPTToken system
  error NotEnoughETH(); // 0x932b84b0
  error NotEnoughGPTTokens(); // 0x134712e2

  // BaseSystem
  error InsufficientEntryFee(uint256 required); // 0xe270e71a
}
