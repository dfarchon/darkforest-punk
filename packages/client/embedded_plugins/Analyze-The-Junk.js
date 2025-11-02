//
// Analyze Junk Planets
//
//
//
//

import {
  html,
  render,
  useState,
  useEffect,
} from "https://unpkg.com/htm/preact/standalone.module.js";

import { EMPTY_ADDRESS } from "https://cdn.skypack.dev/@darkforest_eth/constants";

let show_planets = [];

let my_account = df.getAccount();

export let getEnergyPercent = (planet) => {
  if (!planet) return 0;
  return Math.floor((planet.energy / planet.energyCap) * 100);
};

function drawRound(ctx, p, color, width, alpha) {
  if (!p) return "(???,???)";
  const viewport = ui.getViewport();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = alpha;
  const { x, y } = viewport.worldToCanvasCoords(p.location.coords);
  const range = p.range * 0.01 * 25;
  const trueRange = viewport.worldToCanvasDist(range);
  ctx.beginPath();
  // ctx.setLineDash([10,10]);
  ctx.arc(x, y, trueRange, 0, 2 * Math.PI);
  ctx.stroke();
  return `(${p.location.coords.x},${p.location.coords.y})`;
}

function infoWithColor(text, textColor) {
  return html`<div style=${{ color: textColor }}>${text}</div>`;
}

function main_ui() {
  function get_type_one_planets() {
    let planets = Array.from(df.getMyPlanets()).filter((planet) => {
      if (planet.junkOwner === my_account) return true;
      return false;
    });
    show_planets = planets;
  }

  function get_type_two_planets() {
    let planets = Array.from(df.getAllOwnedPlanets()).filter((planet) => {
      if (planet.junkOwner === my_account && planet.owner !== my_account)
        return true;
      return false;
    });
    show_planets = planets;
  }

  function get_type_three_planets() {
    let planets = Array.from(df.getAllOwnedPlanets()).filter((planet) => {
      if (planet.owner === my_account && planet.junkOwner !== my_account)
        return true;
      else return false;
    });
    show_planets = planets;
  }

  function clearPlanets() {
    show_planets = [];
  }

  let type_one_planets_button = html`<div>
    <button
      style=${{ marginLeft: "8px", width: "200px", height: "100px" }}
      onClick=${get_type_one_planets}
    >
      show Planets that <br />
      planet.owner === me <br />
      planet.junkOwner === me
    </button>
  </div> `;

  let type_two_planets_button = html`<div>
    <button
      style=${{ marginLeft: "8px", width: "200px", height: "100px" }}
      onClick=${get_type_two_planets}
    >
      show Planets that <br />
      planet.owner !== me <br />
      planet.junkOwner === me
    </button>
  </div> `;

  let type_three_planets_button = html`<div>
    <button
      style=${{ marginLeft: "8px", width: "200px", height: "100px" }}
      onClick=${get_type_three_planets}
    >
      show Planets that <br />
      planet.owner === me <br />
      planet.junkOwner !== me
    </button>
  </div> `;

  let clearPlanetsButton = html`<div>
    <button
      style=${{ marginLeft: "8px", width: "200px", height: "50px" }}
      onClick=${clearPlanets}
    >
      Clear Planets
    </button>
  </div> `;

  const flexRow = {
    display: "flex",
    flexDirection: "row",
    marginTop: "16px",
    marginLeft: "10px",
    marginBottom: "10px",
  };

  return html`<div>
    <div style=${{ ...flexRow }}>
      ${type_one_planets_button} ${type_two_planets_button}
    </div>
    <div style=${{ ...flexRow }}>
      ${type_three_planets_button} ${clearPlanetsButton}
    </div>
  </div>`;
}

class Plugin {
  constructor() {
    this.container = null;
  }
  draw(ctx) {
    show_planets.forEach((p) => drawRound(ctx, p, "pink", 5, 1));
  }

  async render(container) {
    this.container = container;
    container.style.width = "450px";
    container.style.height = "280px";
    render(html`<${main_ui} />`, container);
  }
  destroy() {
    render(null, this.container);
  }
}

export default Plugin;
