import { defineWorld } from "@latticexyz/world";

export default defineWorld({
  namespace: "df",
  enums: {
    PlanetStatus: ["DEFAULT", "DESTROYED"],
    PlanetType: ["UNKNOWN", "PLANET", "ASTEROID_FIELD", "FOUNDRY", "SPACETIME_RIP", "QUASAR"],
    SpaceType: ["UNKNOWN", "NEBULA", "SPACE", "DEEP_SPACE", "DEAD_SPACE"],
    Biome: [
      "UNKNOWN",
      "OCEAN",
      "FOREST",
      "GRASSLAND",
      "TUNDRA",
      "SWAMP",
      "DESERT",
      "ICE",
      "WASTELAND",
      "LAVA",
      "CORRUPTED",
    ],
    MaterialType: [
      "UNKNOWN",
      "WATER_CRYSTALS",
      "LIVING_WOOD",
      "WINDSTEEL",
      "AURORIUM",
      "MYCELIUM",
      "SANDGLASS",
      "CRYOSTONE",
      "SCRAPIUM",
      "PYROSTEEL",
      "BLACKALLOY",
      "CORRUPTED_CRYSTAL",
    ],
    ArtifactStatus: ["DEFAULT", "COOLDOWN", "CHARGING", "READY", "ACTIVE", "BROKEN"],
    ArtifactGenre: ["UNKNOWN", "DEFENSIVE", "OFFENSIVE", "PRODUCTIVE", "GENERAL"],
    ArtifactRarity: ["UNKNOWN", "COMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"],
    EffectType: ["UNKNOWN", "STAT", "BEFORE_MOVE", "AFTER_MOVE", "BEFORE_ARRIVAL", "AFTER_ARRIVAL"],
    ModifierType: [
      "UNKNOWN",
      "MULTIPLY_DEFENSE",
      "MULTIPLY_RANGE",
      "MULTIPLY_SPEED",
      "MULTIPLY_POPULATION_GROWTH",
      "MULTIPLY_SILVER_GROWTH",
      "APPLY_EFFECT",
      "REMOVE_EFFECT",
    ],
    PlanetFlagType: ["EXPLORED", "OFFENSIVE_ARTIFACT", "DEFENSIVE_ARTIFACT", "PRODUCTIVE_ARTIFACT", "DESTROYED"],
    GuildStatus: ["UNEXIST", "ACTIVE", "DISBANDED"],
    GuildRole: ["NONE", "MEMBER", "OFFICER", "LEADER"],
    SpaceshipType: ["UNKNOWN", "SCOUT", "FIGHTER", "DESTROYER", "CARRIER"],
    // ArtifactType: [
    //   "UNKNOWN",
    //   "WORMHOLE",
    //   "PLANETARY_SHIELD",
    //   "PHOTOID_CANNON",
    //   "BLOOM_FILTER",
    //   "BLACK_DOMAIN",
    //   "STELLAR_SHIELD",
    //   "BOMB",
    //   "KARDASHEV",
    //   "AVATAR",
    //   "MONOLITH",
    //   "COLLOSSUS",
    //   "SPACESHIP",
    //   "PYRAMID",
    //   "ICE_LINK",
    //   "FIRE_LINK",
    //   "BLIND_BOX",
    //   "SHIP_MOTHERSHIP",
    //   "SHIP_CRESCENT",
    //   "SHIP_WHALE",
    //   "SHIP_GEAR",
    //   "SHIP_TITAN",
    //   "SHIP_PINK",
    // ],
  },
  systems: {
    InitializeSystem: {
      openAccess: false,
    },
    TestOnlySystem: {
      openAccess: false,
    },
    PlanetWriteSystem: {
      openAccess: false,
    },
    DfDelegationControlSystem: {
      name: "DfDelegationCtrl",
    },
    FoundryCraftingSystem: {
      openAccess: false,
    },
    ModuleCraftingSystem: {
      openAccess: false,
    },
    SpaceshipModuleSystem: {
      openAccess: false,
    },
    FoundryUpgradeSystem: {
      openAccess: false,
    },
  },
  excludeSystems: [
    "BaseSystem",
    "ArtifactProxySystem",
    "CannonSystem",
    "WormholeSystem",
    "BloomFilterSystem",
    "PinkBombSystem",
  ],
  tables: {
    Round: {
      schema: {
        num: "uint8",
      },
      key: [],
    },
    Counter: {
      schema: {
        player: "uint32",
        artifact: "uint32",
        move: "uint64",
        guild: "uint32",
      },
      key: [],
    },
    DistanceMultiplier: {
      schema: {
        from: "bytes32",
        to: "bytes32",
        multiplier: "uint32",
      },
      key: ["from", "to"],
    },
    Player: {
      schema: {
        owner: "address",
        burner: "address",
        index: "uint32",
        createdAt: "uint64",
        name: "string",
      },
      key: ["owner"],
    },
    BurnerToPlayer: "address",
    NameToPlayer: "address",
    PlayerWithdrawSilver: {
      schema: {
        player: "address",
        silver: "uint256",
      },
      key: ["player"],
    },
    PlayerScore: {
      schema: {
        player: "address",
        score: "uint256",
      },
      key: ["player"],
    },
    PlayerWithdrawMaterial: {
      schema: {
        player: "address",
        materialType: "uint8",
        amount: "uint256",
      },
      key: ["player", "materialType"],
    },
    SpawnPlanet: {
      schema: {
        player: "address",
        planet: "uint256",
      },
      key: ["player"],
    },
    TempConfigSet: {
      schema: {
        skipProofCheck: "bool",
        playerLimit: "uint32",
        spawnPerlinMin: "uint8",
        spawnPerlinMax: "uint8",
        revealCd: "uint32",
      },
      key: [],
    },
    EntryFee: {
      schema: {
        fee: "uint256",
      },
      key: [],
    },
    UniverseConfig: {
      schema: {
        sparsity: "uint64",
        radius: "uint64",
      },
      key: [],
    },
    SpaceTypeConfig: {
      schema: {
        perlinThresholds: "uint32[]",
        planetLevelLimits: "uint8[]",
        planetLevelBonus: "int8[]",
      },
      key: [],
    },
    UniverseZoneConfig: {
      schema: {
        borders: "uint64[]",
        planetLevelLimits: "uint8[]",
        planetLevelBonus: "int8[]",
      },
      key: [],
    },
    AtfInstallModule: {
      schema: {
        addr: "address",
      },
      key: [],
    },
    ArtifactRegistry: "bool",
    ArtifactWithdrawal: {
      schema: {
        disabled: "bool",
      },
      key: [],
    },
    ArtifactNFT: {
      schema: {
        addr: "address",
      },
      key: [],
    },
    ArtifactConfig: {
      schema: {
        rarity: "ArtifactRarity",
        indexes: "uint8[]",
        probabilities: "uint16[]",
      },
      key: ["rarity"],
    },
    Artifact: {
      schema: {
        id: "uint32",
        artifactIndex: "uint8",
        rarity: "ArtifactRarity",
        biome: "Biome",
        status: "ArtifactStatus",
        chargeTick: "uint64",
        activateTick: "uint64",
        cooldownTick: "uint64",
      },
      key: ["id"],
    },
    // planets owns artifacts
    ArtifactOwner: {
      schema: {
        artifact: "uint32",
        planet: "bytes32",
      },
      key: ["artifact"],
    },
    PlanetArtifact: {
      id: "bytes32",
      artifacts: "uint256", // which means each planet can have at most 8 artifacts
    },
    PlanetLevelConfig: {
      schema: {
        // default level is 0
        // 9 elements indicates 9 levels, from level 1 to level 9
        // ex: [100, 500, 4000, 8000, 30000, 65520, 262128, 1048561, 4194292]
        thresholds: "uint32[]",
      },
      key: [],
    },
    PlanetBiomeConfig: {
      schema: {
        threshold1: "uint32",
        threshold2: "uint32",
      },
      key: [],
    },
    PlanetTypeConfig: {
      schema: {
        spaceType: "SpaceType",
        level: "uint8",
        // length = number of planet types. ex: [253, 0, 2, 0, 1]
        // 253 PLANET, 0 ASTEROID_FIELD, 2 FOUNDRY, 0 SPACETIME_RIP, 1 QUASAR
        thresholds: "uint16[]",
      },
      key: ["spaceType", "level"],
    },
    UpgradeConfig: {
      schema: {
        populationCapMultiplier: "uint8",
        populationGrowthMultiplier: "uint8",
        rangeMultiplier: "uint8",
        speedMultiplier: "uint8",
        defenseMultiplier: "uint8",
        maxSingleLevel: "uint8",
        maxTotalLevel: "uint32", // per space type, dead space | deep space | space | nebula
        silverCost: "uint80", // percentage of silver cap, lvl max | ... | lvl 0
      },
      key: [],
    },
    SnarkConfig: {
      schema: {
        planetHashKey: "uint64",
        biomeBaseKey: "uint64",
        spaceTypeKey: "uint64",
        perlinLengthScale: "uint64",
        // use 1 instead of true
        perlinMirrorX: "uint8",
        // use 1 instead of true
        perlinMirrorY: "uint8",
      },
      key: [],
    },
    // we restrict the type length of speed, defense, so that all fiels fit into one slot
    // if we need larger values, we can make the PlanetInitialResource table be the second
    // metadata table, and benefit from the 2nd slot.
    PlanetMetadata: {
      schema: {
        range: "uint32",
        speed: "uint16",
        defense: "uint16",
        populationCap: "uint64",
        populationGrowth: "uint32",
        silverCap: "uint64",
        silverGrowth: "uint32",
        level: "uint8",
        planetType: "PlanetType",
        spaceType: "SpaceType",
      },
      key: ["spaceType", "planetType", "level"],
    },
    PlanetInitialResource: {
      schema: {
        population: "uint64",
        silver: "uint64",
        level: "uint8",
        planetType: "PlanetType",
        spaceType: "SpaceType",
      },
      key: ["spaceType", "planetType", "level"],
    },
    LastReveal: {
      schema: {
        player: "address",
        tickNumber: "uint64",
      },
      key: ["player"],
    },
    RevealedPlanet: {
      id: "bytes32",
      x: "int32",
      y: "int32",
      revealer: "address",
    },
    ProspectedPlanet: {
      id: "bytes32",
      blockNumber: "uint64",
    },
    Planet: {
      id: "bytes32",
      // status: "PlanetStatus", // planet status is determined by its flags
      lastUpdateTick: "uint64",
      population: "uint64",
      silver: "uint64",
      upgrades: "uint24", // uint8 range | uint8 speed | uint8 defense
      useProps: "bool",
    },
    PlanetConstants: {
      id: "bytes32",
      perlin: "uint8",
      level: "uint8",
      planetType: "PlanetType",
      spaceType: "SpaceType",
    },
    // upgraded planet properties, replaces the original metadata
    PlanetProps: {
      id: "bytes32",
      range: "uint32",
      speed: "uint16",
      defense: "uint16",
      populationCap: "uint64",
      populationGrowth: "uint32",
      silverCap: "uint64",
      silverGrowth: "uint32",
    },
    PlanetFlags: {
      schema: {
        id: "bytes32",
        flags: "uint256",
      },
      key: ["id"],
    },
    PlanetEmoji: {
      schema: {
        id: "bytes32",
        emoji: "string",
      },
      key: ["id"],
      type: "offchainTable",
    },
    PlanetOwner: "address",
    PlanetEffects: {
      id: "bytes32",
      num: "uint8",
      effects: "uint248", // at most 10 effects, each effect is uint24 and is composed of uint8 origin | uint8 type | uint8 internalId
    },
    PendingMove: {
      schema: {
        to: "bytes32",
        head: "uint8",
        number: "uint8",
        indexes: "uint240",
      },
      key: ["to"],
    },
    Move: {
      schema: {
        to: "bytes32",
        index: "uint8",
        from: "bytes32",
        id: "uint64",
        captain: "address",
        departureTick: "uint64",
        arrivalTick: "uint64",
        population: "uint64",
        silver: "uint64",
        artifact: "uint256",
      },
      key: ["to", "index"],
    },
    Ticker: {
      schema: {
        tickNumber: "uint64",
        tickRate: "uint64", // per block
        timestamp: "uint64",
        paused: "bool",
      },
      key: [],
    },
    InnerCircle: {
      schema: {
        radius: "uint64",
        radiusx1000: "uint64",
        speed: "uint64",
      },
      key: [],
    },
    GPTTokens: {
      schema: {
        player: "address",
        amount: "uint256",
      },
      key: ["player"],
    },
    GuildConfig: {
      schema: {
        createFee: "uint128",
        maxMembers: "uint8",
        cooldownTicks: "uint120",
      },
      key: [],
    },
    Guild: {
      schema: {
        id: "uint8",
        status: "GuildStatus",
        rank: "uint8",
        number: "uint8",
        registry: "uint16",
        owner: "uint24", // memberId
        silver: "uint256",
      },
      key: ["id"],
    },
    GuildName: {
      schema: {
        id: "uint8",
        name: "string",
      },
      key: ["id"],
    },
    GuildMember: {
      schema: {
        memberId: "uint24",
        role: "GuildRole",
        grant: "GuildRole",
        joinedAt: "uint64",
        leftAt: "uint64",
        kicked: "bool",
        addr: "address",
      },
      key: ["memberId"],
    },
    GuildHistory: {
      schema: {
        player: "address",
        curMemberId: "uint24",
        memberIds: "uint24[]",
      },
      key: ["player"],
    },
    GuildCandidate: {
      schema: {
        player: "address",
        invitations: "uint8[]",
        applications: "uint8[]",
      },
      key: ["player"],
    },
    RevenueStats: {
      schema: {
        amount: "uint256",
        systemId: "bytes32",
      },
      key: ["systemId"],
    },
    CraftedSpaceship: {
      schema: {
        artifactId: "uint32",
        spaceshipType: "uint8",
        biome: "Biome",
        rarity: "ArtifactRarity",
        craftedAt: "uint64",
        nftTokenId: "uint256",
        crafter: "address",
      },
      key: ["artifactId"],
    },
    SpaceshipBonus: {
      schema: {
        artifactId: "uint32",
        attackBonus: "uint16",
        defenseBonus: "uint16",
        speedBonus: "uint16",
        rangeBonus: "uint16",
      },
      key: ["artifactId"],
    },
    SpaceshipModuleInstalled: {
      schema: {
        moduleId: "uint32",
        artifactId: "uint32",
        moduleSlotType: "uint8", // 1 = ENGINES, 2 = WEAPONS, 3 = HULL, 4 = SHIELD
        installed: "bool",
      },
      key: ["moduleId"],
    },
    SpaceshipSlot: {
      schema: {
        artifactId: "uint32",
        moduleSlotindex: "uint8", // 1 = ENGINES, 2 = WEAPONS, 3 = HULL_SHIELD
        moduleSlotType: "uint8", // 1 = ENGINES, 2 = WEAPONS, 3 = HULL, 4 = SHIELD
        moduleId: "uint32",
      },
      key: ["artifactId", "moduleSlotindex"],
    },
    CraftedModules: {
      schema: {
        artifactId: "uint32",
        moduleType: "uint8",
        biome: "Biome",
        rarity: "ArtifactRarity",
        craftedAt: "uint64",
        crafter: "address",
      },
      key: ["artifactId"],
    },
    ModuleBonus: {
      schema: {
        artifactId: "uint32",
        attackBonus: "uint16",
        defenseBonus: "uint16",
        speedBonus: "uint16",
        rangeBonus: "uint16",
      },
      key: ["artifactId"],
    },
    MaterialUpgradeConfig: {
      schema: {
        upgradeType: "uint8",
        materialType: "MaterialType",
        costMultiplier: "uint16",
      },
      key: ["upgradeType"],
    },
    FoundryCraftingCount: {
      schema: {
        foundryHash: "bytes32",
        count: "uint8",
        lastCraftTime: "uint64",
      },
      key: ["foundryHash"],
    },
    FoundryUpgrade: {
      schema: {
        foundryHash: "bytes32",
        branchLevel: "uint8", // 0 = base, 1 = level 1, 2 = level 2
      },
      key: ["foundryHash"],
    },
    // // artifact module
    // Effect: {
    //   schema: {
    //     id: "uint24",
    //     effectType: "EffectType",
    //     modifierNumber: "uint8", // up to 7 modifiers
    //     modifiers: "uint248", // 32 bits per modifier, including the uint8 type and the uint24 value
    //   },
    //   key: ["id"],
    //   codegen: {
    //     outputDirectory: "../modules/atfs/tables",
    //     tableIdArgument: true,
    //   },
    //   deploy: {
    //     disabled: true,
    //   },
    // },
    // ArtifactMetadata: {
    //   schema: {
    //     rarity: "ArtifactRarity",
    //     genre: "ArtifactGenre",
    //     charge: "uint32",
    //     cooldown: "uint32",
    //     durable: "bool",
    //     reusable: "bool",
    //     reqLevel: "uint16", // uint8 upbound | uint8 lowerbound, lowerbound <= planetLevel < upbound
    //     reqPopulation: "uint64",
    //     reqSilver: "uint64",
    //   },
    //   key: ["rarity"],
    //   codegen: {
    //     outputDirectory: "../modules/atfs/tables",
    //     tableIdArgument: true,
    //   },
    //   deploy: {
    //     disabled: true,
    //   },
    // },
    // WormholeDest: {
    //   schema: {
    //     wormholeId: "uint32",
    //     to: "bytes32",
    //   },
    //   key: ["wormholeId"],
    //   codegen: {
    //     outputDirectory: "../modules/atfs/Wormhole/tables",
    //     tableIdArgument: true,
    //   },
    //   deploy: {
    //     disabled: true,
    //   },
    // },
    // WormholeRecord: {
    //   schema: {
    //     from: "bytes32",
    //     to: "bytes32",
    //     hasWormhole: "bool",
    //   },
    //   key: ["from", "to"],
    //   codegen: {
    //     outputDirectory: "../modules/atfs/Wormhole/tables",
    //     tableIdArgument: true,
    //   },
    //   deploy: {
    //     disabled: true,
    //   },
    // },
    // WormholeDest: {
    //   schema: {
    //     wormholeId: "uint32",
    //     to: "bytes32",
    //   },
    //   key: ["wormholeId"],
    //   codegen: {
    //     outputDirectory: "../modules/atfs/Wormhole/tables",
    //     tableIdArgument: true,
    //   },
    //   deploy: {
    //     disabled: true,
    //   },
    // },
    // WormholeRecord: {
    //   schema: {
    //     from: "bytes32",
    //     to: "bytes32",
    //     hasWormhole: "bool",
    //   },
    //   key: ["from", "to"],
    //   codegen: {
    //     outputDirectory: "../modules/atfs/Wormhole/tables",
    //     tableIdArgument: true,
    //   },
    //   deploy: {
    //     disabled: true,
    //   },
    // },
    // PinkBomb: {
    //   schema: {
    //     bombId: "uint32",
    //     target: "bytes32",
    //     departureTick: "uint64",
    //     arrivalTick: "uint64",
    //   },
    //   key: ["bombId"],
    //   codegen: {
    //     outputDirectory: "../modules/atfs/PinkBomb/tables",
    //     tableIdArgument: true,
    //   },
    //   deploy: {
    //     disabled: true,
    //   },
    // },
    JunkConfig: {
      schema: {
        SPACE_JUNK_ENABLED: "bool",
        ABANDON_SPEED_CHANGE_PERCENT: "uint256",
        ABANDON_RANGE_CHANGE_PERCENT: "uint256",
        SPACE_JUNK_FREE_ALLOCATION: "uint256",
        SPACE_JUNK_LINEAR_MIN_PURCHASE: "uint256",
        SPACE_JUNK_LINEAR_MAX_PURCHASE: "uint256",
        SPACE_JUNK_LINEAR_BASE_PRICE: "uint256",
        SPACE_JUNK_QUADRATIC_MIN_PURCHASE: "uint256",
        SPACE_JUNK_QUADRATIC_MAX_PURCHASE: "uint256",
        SPACE_JUNK_QUADRATIC_BASE_PRICE: "uint256",
        PLANET_LEVEL_JUNK: "uint256[]",
      },
      key: [],
    },
    PlanetJunkOwner: "address",
    PlanetAddJunkTick: "uint256",
    PlayerJunk: {
      schema: {
        owner: "address",
        junk: "uint256",
      },
      key: ["owner"],
    },
    PlayerJunkLimit: {
      schema: {
        owner: "address",
        junk: "uint256",
      },
      key: ["owner"],
    },
    PlanetMaterialStorage: {
      schema: {
        planetId: "bytes32",
        exsitMap: "uint256",
      },
      key: ["planetId"],
    },
    PlanetMaterial: {
      schema: {
        planetId: "bytes32",
        resourceId: "uint8",
        amount: "uint256",
      },
      key: ["planetId", "resourceId"],
    },
    PlanetMaterialGrowth: {
      schema: {
        planetId: "bytes32",
        resourceId: "uint8",
        growth: "bool",
      },
      key: ["planetId", "resourceId"],
    },
    MoveMaterial: {
      schema: {
        moveId: "uint64",
        resourceId: "uint8",
        amount: "uint256",
      },
      key: ["moveId", "resourceId"],
    },
    GlobalStats: {
      schema: {
        registerPlayerCount: "uint256",
        spawnPlayerCount: "uint256",
        createGuildCount: "uint256",
        prospectPlanetCount: "uint256",
        findArtifactCount: "uint256",
        withdrawArtifactCount: "uint256",
        depositArtifactCount: "uint256",
        chargeArtifactCount: "uint256",
        shutdownArtifactCount: "uint256",
        activateArtifactCount: "uint256",
        buyGPTTokensCount: "uint256",
        spendGPTTokensCount: "uint256",
        sendGPTTokensCount: "uint256",
        moveCount: "uint256",
        attackCount: "uint256",
        setPlanetEmojiCount: "uint256",
        addJunkCount: "uint256",
        clearJunkCount: "uint256",
        revealLocationCount: "uint256",
        upgradePlanetCount: "uint256",
        withdrawSilverCount: "uint256",
        withdrawMaterialCount: "uint256",
        craftSpaceshipCount: "uint256",
        upgradeFoundryCount: "uint256",
      },
      key: [],
    },
    PlayerStats: {
      schema: {
        player: "address",
        prospectPlanetCount: "uint256",
        findArtifactCount: "uint256",
        withdrawArtifactCount: "uint256",
        depositArtifactCount: "uint256",
        chargeArtifactCount: "uint256",
        shutdownArtifactCount: "uint256",
        activateArtifactCount: "uint256",
        buyGPTTokensCount: "uint256",
        spendGPTTokensCount: "uint256",
        sendGPTTokensCount: "uint256",
        moveCount: "uint256",
        attackCount: "uint256",
        setPlanetEmojiCount: "uint256",
        addJunkCount: "uint256",
        clearJunkCount: "uint256",
        revealLocationCount: "uint256",
        upgradePlanetCount: "uint256",
        withdrawSilverCount: "uint256",
        withdrawMaterialCount: "uint256",
        craftSpaceshipCount: "uint256",
        upgradeFoundryCount: "uint256",
      },
      key: ["player"],
    },
  },
});
