function print_score(players) {
  console.log(`total ${players.length}`);

  for (let player of players) {
    console.log(`${player.player}: ${player.score}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sort_players(m) {
  let a = Array.from(m);

  let sortPart = a.filter((t) => t[1] !== undefined);
  let notSortPart = a.filter((t) => t[1] === undefined);

  sortPart.sort((a, b) => {
    return b[1] - a[1];
  });

  let res = [];
  for (let i = 0; i < sortPart.length; i++) {
    let t = sortPart[i];
    res.push(t);
  }

  for (let i = 0; i < notSortPart.length; i++) {
    let t = notSortPart[i];
    res.push(t);
  }

  return res;
}

function create_head() {
  let row = document.createElement("tr");
  row.style.width = "100%";
  row.style.height = "26px";

  for (let i = 0; i < 3; i++) {
    let field = document.createElement("th");
    row.appendChild(field);
  }

  row.children[0].innerHTML = "place";
  row.children[1].innerHTML = "player";
  row.children[2].innerHTML = "score"; //row.children[0].style.width = "100px";// no effect

  row.children[0].style.width = "40px";
  row.children[1].style.width = "146px";
  row.children[2].style.width = "80px"; //row.children[2].innerHTML = "junk";

  return row;
}

function create_row() {
  let row = document.createElement("tr");
  row.style.width = "100%";
  row.style.height = "26px";
  let rank = document.createElement("td");
  rank.style.textAlign = "right";
  row.appendChild(rank);
  let user = document.createElement("td"); //field1.style.width = "100px";// no effect

  user.style.maxWidth = "146px";
  user.style.overflow = "hidden";
  row.appendChild(user);
  let score = document.createElement("td");
  score.style.textAlign = "right";
  row.appendChild(score);
  return row;
}

function timestampSection(value) {
  return value.toString().padStart(2, "0");
}

class Plugin {
  constructor() {
    // this.begin_time = new Date('2023-07-19 19:00:00.000 GMT+0800');
    // this.end_time = new Date("2025-04-27T13:00:00Z");
    // this.end_time = new Date("2025-07-25T13:00:00Z");
    this.end_time = new Date("2025-10-31T13:00:00Z");
    this.timer = document.createElement("div");
    this.timer.style.width = "100%";
    this.timer.style.textAlign = "center";

    this.table = document.createElement("table"); //this.table.style.width = '100%';

    this.table.style.maxHeight = "300px";
    this.table.style.display = "block";
    this.table.style.borderSpacing = "8px 0"; // take effect only when borderCollapse is `separate`

    this.table.style.borderCollapse = "separate";
    this.table.style.overflow = "scroll"; //this.table.style. tableLayout="fixed";
    // this.table.style.height = '26px';
    //this.table.style.textAlign = "right";

    this.table.appendChild(create_head());
    let n = df.getAllPlayers().length;
    for (let i = 0; i < n; i++) {
      this.table.appendChild(create_row());
    }

    this.n = n;
    this.scoreboard = new Map();
    this.refresh_button = document.createElement("button");
    this.refresh_button.style.width = "100%";
    this.refresh_button.style.height = "26px";
    this.refresh_button.innerText = "refresh";
    this.refresh_button.onclick = this.update_players;
    this.interval_handle = window.setInterval(this.update_timer, 1000);
    this.update_timer();
    this.update_players();
  }

  update_timer = () => {
    let now = new Date();
    let t = Math.floor((this.end_time - now) / 1000);

    if (t < 0) {
      t = 0;
    }

    let h = Math.floor(t / 3600);
    let m = Math.floor((t - h * 3600) / 60);
    let s = t - h * 3600 - m * 60;
    this.timer.innerText =
      timestampSection(h) +
      ":" +
      timestampSection(m) +
      ":" +
      timestampSection(s);
  };
  update_table = () => {
    let players = sort_players(this.scoreboard);

    for (let i = this.n; i <= players.length; i++) {
      this.table.appendChild(create_row());
    }

    this.n = players.length;

    for (let i = 0; i < players.length; i++) {
      this.table.children[i + 1].children[0].innerHTML = `${i + 1}.`; // rank

      this.table.children[i + 1].children[2].innerHTML =
        players[i][1] === undefined ? "n/a" : players[i][1]; //score

      let name = players[i][0];
      let p_data = df.players.get(name);

      if (p_data.twitter) {
        name = `<a href="https://twitter.com/${p_data.twitter}" >@${p_data.twitter}</a>`;
      }

      this.table.children[i + 1].children[1].innerHTML = name;
    }

    if (players.length >= 1) {
      this.table.children[1].style.color = "#ff44b7";
    }

    const lvl_2 = Math.min(players.length, 3);
    for (let i = 2; i <= lvl_2; i++) {
      this.table.children[i].style.color = "#f8b73e";
    }

    const lvl_3 = Math.min(players.length, 7);
    for (let i = 4; i <= lvl_3; i++) {
      this.table.children[i].style.color = "#c13cff";
    }

    const lvl_4 = Math.min(players.length, 15);
    for (let i = 8; i <= lvl_4; i++) {
      this.table.children[i].style.color = "#6b68ff";
    }

    const lvl_5 = Math.min(players.length, 31);
    for (let i = 16; i <= lvl_5; i++) {
      this.table.children[i].style.color = "green";
    }

    const lvl_6 = Math.min(players.length, 63);
    for (let i = 32; i <= lvl_6; i++) {
      this.table.children[i].style.color = "white";
    }
  };
  update_score = (players) => {
    if (!this.table) {
      return;
    }

    for (let player of players) {
      let address = player.address.toLowerCase();
      let score = Math.floor(df.getPlayerScore(address) / 1000);

      this.scoreboard.set(player.address.toLowerCase(), score);
    }

    this.update_table();
  };
  update_players = async () => {
    this.refresh_button.innerText = "refreshing...";
    this.refresh_button.disabled = true;
    let players = Array.from(df.getAllPlayers());
    let player_numbers = players.length;
    console.log("player number", player_numbers);
    let counter = 0;
    const batch_size = 100;

    await sleep(1000);

    this.update_score(players);

    // for (let i = 0; i < player_numbers; i += batch_size) {
    //   const end = i + batch_size < player_numbers ? i + batch_size : player_numbers;
    //   df.contractsAPI.contract.bulkGetPlayers(i, end).then((values) => {
    //     //players.push(...values);
    //     //print_score(values);
    //     this.update_score(values);
    //     counter += values.length;
    //     console.log('update score for player', counter);
    //     this.refresh_button.innerText = `refreshing...${Math.floor(
    //       (counter * 100) / player_numbers
    //     )}%`;

    //     if (counter === player_numbers) {
    //       this.refresh_button.innerText = 'refresh';
    //       this.refresh_button.disabled = false;
    //     }
    //   });
    // }
    this.refresh_button.innerText = "refresh";
    this.refresh_button.disabled = false;
  };
  /**
   * Called when plugin is launched with the "run" button.
   */

  async render(container) {
    container.style.width = "300px";
    container.appendChild(this.timer);
    container.appendChild(this.table);
    container.appendChild(this.refresh_button);
  }
  /**
   * Called when plugin modal is closed.
   */

  destroy() {
    this.timer = null;
    this.table = null;
    this.refresh_button = null;

    if (this.interval_handle) {
      window.clearInterval(this.interval_handle);
      this.interval_handle = null;
    }
  }
}
/**
 * And don't forget to export it!
 */

export default Plugin;
