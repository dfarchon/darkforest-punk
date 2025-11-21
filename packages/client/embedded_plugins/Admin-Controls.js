// organize-imports-ignore
import {
  LogoType,
  LogoTypeNames,
  ArtifactRarityNames,
  ArtifactTypeNames,
  BiomeNames,
  PlanetType,
  PlanetTypeNames, //@ts-ignore
} from "https://cdn.skypack.dev/@dfares/types";
import {
  logoTypeToNum,
  getPlanetNameHash, //@ts-ignore
} from "https://cdn.skypack.dev/@dfares/procedural";
import {
  EMPTY_ADDRESS,
  MAX_ARTIFACT_RARITY,
  MIN_ARTIFACT_RARITY,
  MIN_SPACESHIP_TYPE,
  MAX_SPACESHIP_TYPE,
  MIN_BIOME,
  MAX_BIOME,
  MIN_ARTIFACT_TYPE, //@ts-ignore
} from "https://cdn.skypack.dev/@dfares/constants";
import {
  locationIdToDecStr,
  artifactIdFromHexStr,
  locationIdFromDecStr, //@ts-ignore
} from "https://cdn.skypack.dev/@dfares/serde";
import {
  html,
  render,
  useEffect,
  useState,
  useCallback, //@ts-ignore
} from "https://esm.sh/htm/preact/standalone";

async function initPlanet(planet) {
  if (planet.isInContract) return;
  const x = planet.location.coords.x;
  const y = planet.location.coords.y;
  const distFromOriginSquare = x * x + y * y;
  const args = Promise.resolve([
    locationIdToDecStr(planet.locationId),
    planet.perlin,
    distFromOriginSquare,
  ]);
  const tx = await df.submitTransaction({
    args,
    contract: df.getContract(),
    methodName: "adminInitializePlanet",
  });
  await tx.confirmedPromise;
  return tx;
}

async function takeOwnership(planet, newOwner) {
  if (!newOwner) {
    alert("no account");
    return;
  }

  if (!planet) {
    alert("no selected planet");
    return;
  }

  const snarkArgs = await df.getSnarkHelper().getInitArgs(
    planet.location.coords.x,
    planet.location.coords.y,
    Math.floor(
      Math.sqrt(planet.location.coords.x ** 2 + planet.location.coords.y ** 2),
    ) + 1, // floor(sqrt(x^2 + y^2)) + 1
  );
  const args = Promise.resolve([newOwner, ...snarkArgs]);

  const account = df.getAccount();
  const player = df.getPlayer(account);

  const tx = await df.submitTransaction({
    delegator: player.address,
    locationId: planet.locationId,
    newOwner,
    args,
    contract: df.getContract(),
    methodName: "df__safeSetOwner",
  });
  tx.confirmedPromise.then(() => df.hardRefreshPlanet(planet.locationId));
  return tx;
}

async function pauseGame() {
  const account = df.getAccount();
  const player = df.getPlayer(account);
  const txIntent = {
    delegator: player.address,
    methodName: "df__pause",
    contract: df.getContract(),
    args: Promise.resolve([]),
  };

  const tx = await df.submitTransaction(txIntent);
  return tx;
}

async function unpauseGame() {
  const account = df.getAccount();
  const player = df.getPlayer(account);

  const tx = await df.submitTransaction({
    delegator: player.address,
    args: Promise.resolve([]),
    contract: df.getContract(),
    methodName: "df__unpause",
  });
  return tx;
}

async function updateTickRate(tickRate) {
  const account = df.getAccount();
  const player = df.getPlayer(account);
  const args = Promise.resolve([Number(tickRate)]);
  const tx = await df.submitTransaction({
    delegator: player.address,
    args,
    contract: df.getContract(),
    methodName: "df__updateTickRate",
  });
  return tx;
}

async function createPlanet(coords, level, type) {
  coords.x = Math.round(coords.x);
  coords.y = Math.round(coords.y);
  const location = df.locationBigIntFromCoords(coords).toString();
  const perlinValue = df.biomebasePerlin(coords, true);

  // Convert dropdown value (0-based, excluding UNKNOWN) to contract enum value
  // Dropdown: 0=PLANET, 1=ASTEROID_FIELD, 2=FOUNDRY, 3=SPACETIME_RIP, 4=QUASAR, 5=SUN, 6=STARBASE
  // Contract enum: UNKNOWN=0, PLANET=1, ASTEROID_FIELD=2, FOUNDRY=3, SPACETIME_RIP=4, QUASAR=5, SUN=6, STARBASE=7
  // So we need to add 1 to convert dropdown value to enum value
  const dropdownValue = Number(type);
  const planetTypeEnum = dropdownValue + 1;

  const perlin = Math.round(df.spaceTypePerlin(coords));
  const distFromOrigin = Math.sqrt(coords.x ** 2 + coords.y ** 2);
  const spaceType = df.spaceTypeFromPerlin(perlin, distFromOrigin);

  const account = df.getAccount();
  const player = df.getPlayer(account);
  // Use the account address as owner instead of EMPTY_ADDRESS
  // This ensures the planet is properly initialized with owner and junk owner
  // (df__createPlanet sets both PlanetOwner and PlanetJunkOwner when owner is provided)
  const ownerAddress = player?.address || account || EMPTY_ADDRESS;

  const args = Promise.resolve([
    location,
    ownerAddress,
    perlinValue,
    level,
    planetTypeEnum,
    spaceType,
    1000000,
    0,
    0,
  ]);

  const tx = await df.submitTransaction({
    delegator: player.address,
    args,
    contract: df.getContract(),
    methodName: "df__createPlanet",
  });
  await tx.confirmedPromise;
  const revealArgs = [location, coords.x, coords.y]; // df.getSnarkHelper().getRevealArgs(coords.x, coords.y);
  const revealTx = await df.submitTransaction({
    delegator: player.address,
    args: revealArgs,
    contract: df.getContract(),
    methodName: "df__revealPlanetByAdmin",
  });
  await revealTx.confirmedPromise;

  // Wait a bit for MUD components to sync after transaction confirmation
  await new Promise((resolve) => setTimeout(resolve, 500));

  const locationId = locationIdFromDecStr(location);

  // Refresh planet data from contract
  await df.hardRefreshPlanet(locationId);

  // Get the planet to retrieve its data
  const planet = df.getPlanetWithId(locationId);

  if (planet) {
    // Use the coordinates we already have from the createPlanet call
    // Create WorldLocation from planet and coordinates
    const planetLocation = {
      hash: locationId,
      coords: { x: coords.x, y: coords.y },
      perlin: planet.perlin,
      biomebase: df.biomebasePerlin(coords, true),
    };

    // Add planet location to the game map (this will also insert it into layeredMap)
    df.getGameObjects().addPlanetLocation(planetLocation);

    // Mark as revealed
    df.getGameObjects().markLocationRevealed({
      ...planetLocation,
      revealer: df.getAccount(),
    });

    // Force an update to ensure planet is rendered
    df.getGameObjects().forceTick(locationId);

    // Create a chunk for the planet location to persist it to IndexedDB
    // This ensures the planet is remembered even after page reload
    // Calculate chunk footprint (aligned chunk containing the coordinates)
    const MIN_CHUNK_SIZE = 16; // Minimum chunk size constant
    const chunkX = Math.floor(coords.x / MIN_CHUNK_SIZE) * MIN_CHUNK_SIZE;
    const chunkY = Math.floor(coords.y / MIN_CHUNK_SIZE) * MIN_CHUNK_SIZE;
    const chunk = {
      chunkFootprint: {
        bottomLeft: { x: chunkX, y: chunkY },
        sideLength: MIN_CHUNK_SIZE,
      },
      planetLocations: [planetLocation],
      perlin: planet.perlin,
    };

    // Add chunk to persist to IndexedDB
    if (df.addNewChunk) {
      df.addNewChunk(chunk);
    } else {
      console.warn(
        "df.addNewChunk not available - planet may not persist to IndexedDB",
      );
    }

    // Center view on the new planet
    ui.centerLocationId(locationId);
  } else {
    console.warn(
      "Planet created but not found after refresh, planet may not appear on map",
    );
  }
}

async function revealPlanet(coords, level, type) {
  const account = df.getAccount();
  const player = df.getPlayer(account);
  coords.x = Math.round(coords.x);
  coords.y = Math.round(coords.y);
  const location = df.locationBigIntFromCoords(coords).toString();
  const revealArgs = [location, coords.x, coords.y]; //df.getSnarkHelper().getRevealArgs(coords.x, coords.y);
  const revealTx = await df.submitTransaction({
    delegator: player.address,
    args: revealArgs,
    contract: df.getContract(),
    methodName: "df__revealPlanetByAdmin",
  });
  await revealTx.confirmedPromise;

  // Wait a bit for MUD components to sync after transaction confirmation
  await new Promise((resolve) => setTimeout(resolve, 500));

  const locationId = locationIdFromDecStr(location);

  // Refresh planet data from contract
  await df.hardRefreshPlanet(locationId);

  // Get the planet to retrieve its data
  const planet = df.getPlanetWithId(locationId);

  if (planet) {
    // Use the coordinates we already have from the revealPlanet call
    // Create WorldLocation from planet and coordinates
    const planetLocation = {
      hash: locationId,
      coords: { x: coords.x, y: coords.y },
      perlin: planet.perlin,
      biomebase: df.biomebasePerlin(coords, true),
    };

    // Add planet location to the game map (this will also insert it into layeredMap)
    df.getGameObjects().addPlanetLocation(planetLocation);

    // Mark as revealed
    df.getGameObjects().markLocationRevealed({
      ...planetLocation,
      revealer: df.getAccount(),
    });

    // Force an update to ensure planet is rendered
    df.getGameObjects().forceTick(locationId);

    // Create a chunk for the planet location to persist it to IndexedDB
    // This ensures the planet is remembered even after page reload
    // Calculate chunk footprint (aligned chunk containing the coordinates)
    const MIN_CHUNK_SIZE = 16; // Minimum chunk size constant
    const chunkX = Math.floor(coords.x / MIN_CHUNK_SIZE) * MIN_CHUNK_SIZE;
    const chunkY = Math.floor(coords.y / MIN_CHUNK_SIZE) * MIN_CHUNK_SIZE;
    const chunk = {
      chunkFootprint: {
        bottomLeft: { x: chunkX, y: chunkY },
        sideLength: MIN_CHUNK_SIZE,
      },
      planetLocations: [planetLocation],
      perlin: planet.perlin,
    };

    // Add chunk to persist to IndexedDB
    if (df.addNewChunk) {
      df.addNewChunk(chunk);
    } else {
      console.warn(
        "df.addNewChunk not available - planet may not persist to IndexedDB",
      );
    }

    // Center view on the new planet
    ui.centerLocationId(locationId);
  } else {
    console.warn(
      "Planet revealed but not found after refresh, planet may not appear on map",
    );
  }
}

function PlanetLink({ planetId }) {
  if (planetId) {
    return html`<a
      style=${{
        cursor: "pointer",
        textDecoration: "underline",
        color: "#00ADE1",
      }}
      onClick=${() => ui.centerLocationId(planetId)}
    >
      ${getPlanetNameHash(planetId)}
    </a>`;
  } else {
    return "(none selected)";
  }
}

function Heading({ title }) {
  return html`<h2
    style=${{
      fontSize: "14pt",
      textDecoration: "underline",
    }}
  >
    ${title}
  </h2>`;
}

function accountOptions(players) {
  const options = [];

  for (const player of players) {
    options.push(
      html`<option value=${player.address}>
        ${player.twitter || player.address}
      </option>`,
    );
  }

  return options;
}

function planetTypeOptions() {
  const options = [];

  // Explicitly map contract enum values to dropdown options
  // Contract enum: UNKNOWN=0, PLANET=1, ASTEROID_FIELD=2, FOUNDRY=3, SPACETIME_RIP=4, QUASAR=5, SUN=6, STARBASE=7
  // Dropdown values are 0-based excluding UNKNOWN: 0=PLANET, 1=ASTEROID_FIELD, 2=FOUNDRY, 3=SPACETIME_RIP, 4=QUASAR, 5=SUN, 6=STARBASE
  // In createPlanet, we convert dropdown value to enum by adding 1: dropdown value 0 → enum value 1 (PLANET)

  // Map contract enum index to dropdown value and display name
  const contractPlanetTypes = [
    { enumValue: 1, name: "Planet" }, // PLANET
    { enumValue: 2, name: "Asteroid Field" }, // ASTEROID_FIELD (SILVER_MINE in client)
    { enumValue: 3, name: "Foundry" }, // FOUNDRY (RUINS in client)
    { enumValue: 4, name: "Spacetime Rip" }, // SPACETIME_RIP (TRADING_POST in client)
    { enumValue: 5, name: "Quasar" }, // QUASAR
    { enumValue: 6, name: "Sun" }, // SUN
    { enumValue: 7, name: "Starbase" }, // STARBASE
  ];

  for (const planetType of contractPlanetTypes) {
    // Dropdown value = enumValue - 1 (0-based, excluding UNKNOWN)
    const dropdownValue = planetType.enumValue - 1;
    // Use explicit name to avoid any mapping issues with PlanetTypeNames
    const displayName = planetType.name;
    // Ensure value is explicitly set as a number string for proper binding
    options.push(
      html`<option value="${dropdownValue}">${displayName}</option>`,
    );
  }

  return options;
}

function Select({ style, value, onChange, items }) {
  // Ensure value is a string for proper HTML select binding
  const stringValue = String(value);
  return html`
    <select
      style=${{
        ...style,
        outline: "none",
        background: "#151515",
        color: "#838383",
        borderRadius: "4px",
        border: "1px solid #777",
        width: "100%",
        padding: "2px 6px",
        cursor: "pointer",
      }}
      value=${stringValue}
      onChange=${onChange}
    >
      ${items}
    </select>
  `;
}

const wrapperStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};
const rowStyle = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
};

function PlanetCreator() {
  const uiEmitter = ui.getUIEmitter();
  const [level, setLevel] = useState(0);
  // Initialize to 0 (dropdown value for PLANET, which is index 1 in enum, value 0 in dropdown)
  // Dropdown values are 0-based excluding UNKNOWN: 0=PLANET, 1=ASTEROID_FIELD, 2=FOUNDRY, etc.
  const [planetType, setPlanetType] = useState(0);
  const [choosingLocation, setChoosingLocation] = useState(false);
  const [planetCoords, setPlanetCoords] = useState(null);
  const placePlanet = useCallback(
    (coords) => {
      console.log(
        "placePlanet called with planetType:",
        planetType,
        "type:",
        typeof planetType,
      );
      createPlanet(coords, parseInt(level), planetType);
      setChoosingLocation(false);
    },
    [level, planetType, setChoosingLocation],
  );
  const updatePlanetCoords = useCallback(
    (coords) => {
      setPlanetCoords(coords);
    },
    [setPlanetCoords],
  );
  useEffect(() => {
    if (choosingLocation) {
      uiEmitter.on("WorldMouseClick", placePlanet);
      uiEmitter.on("WorldMouseMove", updatePlanetCoords);
      return () => {
        uiEmitter.off("WorldMouseClick", placePlanet);
        uiEmitter.off("WorldMouseMove", updatePlanetCoords);
      };
    }

    return () => {};
  }, [uiEmitter, choosingLocation, placePlanet, updatePlanetCoords]);
  return html`
    <div
      style=${{
        width: "100%",
      }}
    >
      <${Heading} title="Create Planet" />

      <div style=${rowStyle}>
        <df-slider
          label="Planet Level"
          value=${level}
          onChange=${(e) => setLevel(e.target.value)}
          max=${9}
        ></df-slider>
        <div>
          <label for="planet-type-selector">Planet Type</label>
          <${Select}
            id="planet-type-selector"
            value=${String(planetType)}
            onChange=${(e) => {
              const value = Number(e.target.value);
              console.log(
                "Planet type changed - dropdown value:",
                value,
                "will become enum:",
                value + 1,
              );
              setPlanetType(value);
            }}
            items=${planetTypeOptions()}
          />
        </div>
      </div>
      <div
        style=${{
          ...rowStyle,
          justifyContent: "space-between",
        }}
      >
        ${!choosingLocation &&
        html`
          <df-button
            onClick=${() => {
              setChoosingLocation(true);
            }}
          >
            Choose Planet Location
          </df-button>
        `}
        ${choosingLocation &&
        html` <p>
          Creating planet on coords <br />
          (${Math.round(planetCoords?.x)}, ${Math.round(planetCoords?.y)})
        </p>`}
        ${choosingLocation &&
        html`<df-button onClick=${() => setChoosingLocation(false)}>
          Cancel Creation</df-button
        >`}
      </div>
      <br />
      <div style=${rowStyle}>
        <df-button
          onClick=${() => {
            createPlanet(
              {
                x: 0,
                y: 0,
              },
              parseInt("9"),
              0, // Dropdown value 0 = PLANET
            );
          }}
          >Add Center Planet</df-button
        >

        <df-button
          onClick=${() => {
            revealPlanet(
              {
                x: 0,
                y: 0,
              },
              parseInt("9"),
              0, // Dropdown value 0 = PLANET
            );
          }}
          >Reveal Center Planet</df-button
        >
      </div>
    </div>
  `;
}

function ChangeTickRate() {
  const [tickRate, setTickRate] = useState(df.getCurrentTickerRate());
  return html`
    <div
      style=${{
        width: "100%",
      }}
    >
      <${Heading} title="Change Tick Rate" />
      <div style=${rowStyle}>
        <df-slider
          label="Tick Rate"
          value=${tickRate}
          onChange=${(e) => setTickRate(e.target.value)}
          min=${1}
          max=${200}
        ></df-slider>

        <span style=${{ width: "130px" }}>
          <df-button
            onClick=${() => {
              updateTickRate(tickRate);
            }}
          >
            Update Tick Rate
          </df-button>
        </span>
      </div>
    </div>
  `;
}

function App() {
  const [selectedPlanet, setSelectedPlanet] = useState(null);
  const [account, setAccount] = useState(null);
  const [player, setPlayer] = useState(null);
  const [targetAccount, setTargetAccount] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);

  useEffect(() => {
    const account = df.getAccount();
    setAccount(account);
    setTargetAccount(account);
    if (account) {
      const player = df.getPlayer(account);
      setPlayer(player);
    }
  }, []);

  useEffect(() => {
    const refreshPlayers = () => {
      setAllPlayers(df.getAllPlayers());
    };

    const sub = df.playersUpdated$.subscribe(refreshPlayers);
    refreshPlayers();
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    const subscription = ui.selectedPlanetId$.subscribe((p) => {
      setSelectedPlanet(ui.getPlanetWithId(p));
    });
    return () => subscription.unsubscribe();
  }, [setSelectedPlanet]);

  return html`
    <div style=${wrapperStyle}>
      <p>Main account: ${account}</p>
      <p>Game Account: ${player?.burner}</p>

      <${Heading} title="Game state" />

      <div style=${rowStyle}>
        <span>Change game state:</span>
        <df-button onClick=${() => pauseGame()}> Pause </df-button>
        <df-button onClick=${() => unpauseGame()}> Unpause </df-button>
      </div>

      <div style=${rowStyle}>
        <${ChangeTickRate} />
      </div>

      <${Heading} title="Give Planets" />

      <div style=${rowStyle}>
        <span>
          Planet: <${PlanetLink} planetId=${selectedPlanet?.locationId} />
        </span>
        <span> to </span>
        <${Select}
          style=${{
            flex: "1",
          }}
          value=${targetAccount}
          onChange=${(e) => setTargetAccount(e.target.value)}
          items=${accountOptions(allPlayers)}
        />
        <df-button
          onClick=${() => takeOwnership(selectedPlanet, targetAccount)}
        >
          Give Planet
        </df-button>
      </div>

      <div style=${rowStyle}>
        <${PlanetCreator} />
      </div>
    </div>
  `;
}

class Plugin {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async render(container) {
    container.style.width = "500px";
    container.style.height = "500px";
    render(html`<${App} />`, container);
  }
}

export default Plugin;
