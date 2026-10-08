// MLB Draft Duel — player database
// Public player names + plausible rating values (bat 0-100 for hitters, arm 0-100 for pitchers).
// Grouped by team abbr -> era -> position. Eras: "2020s" (present), "2010s", "2000s", "1990s", "1980s", "1970s".
// Positions: C,1B,2B,SS,3B,OF,DH,P. DH/UTL slots accept any hitter; OF accepts any OF.
// Ratings are rough, for gameplay only — not official.

const TEAMS = {
  ARI: "Arizona Diamondbacks", ATL: "Atlanta Braves", BAL: "Baltimore Orioles",
  BOS: "Boston Red Sox", CHC: "Chicago Cubs", CWS: "Chicago White Sox",
  CIN: "Cincinnati Reds", CLE: "Cleveland Guardians", COL: "Colorado Rockies",
  DET: "Detroit Tigers", HOU: "Houston Astros", KC: "Kansas City Royals",
  LAA: "Los Angeles Angels", LAD: "Los Angeles Dodgers", MIA: "Miami Marlins",
  MIL: "Milwaukee Brewers", MIN: "Minnesota Twins", NYM: "New York Mets",
  NYY: "New York Yankees", OAK: "Oakland Athletics", PHI: "Philadelphia Phillies",
  PIT: "Pittsburgh Pirates", SD: "San Diego Padres", SF: "San Francisco Giants",
  SEA: "Seattle Mariners", STL: "St. Louis Cardinals", TB: "Tampa Bay Rays",
  TEX: "Texas Rangers", TOR: "Toronto Blue Jays", WSH: "Washington Nationals"
};

const ERAS = ["2020s", "2010s", "2000s", "1990s", "1980s", "1970s"];

// Team colours (primary background, secondary ring/text) — the clubs' real
// colour identities, used to render an ORIGINAL coloured badge with the team's
// abbreviation. We deliberately do NOT use official MLB logos (trademarked);
// this is our own simple roundel so teams are visually distinct and legit.
const TEAM_COLORS = {
  ARI:["#A71930","#E3D4AD"], ATL:["#13274F","#CE1141"], BAL:["#DF4601","#000000"],
  BOS:["#BD3039","#0C2340"], CHC:["#0E3386","#CC3433"], CWS:["#27251F","#C4CED4"],
  CIN:["#C6011F","#000000"], CLE:["#0C2340","#E31937"], COL:["#333366","#C4CED4"],
  DET:["#0C2340","#FA4616"], HOU:["#002D62","#EB6E1F"], KC:["#004687","#BD9B60"],
  LAA:["#BA0021","#003263"], LAD:["#005A9C","#EF3E42"], MIA:["#00A3E0","#EF3340"],
  MIL:["#12284B","#FFC52F"], MIN:["#002B5C","#D31145"], NYM:["#002D72","#FF5910"],
  NYY:["#0C2340","#C4CED4"], OAK:["#003831","#EFB21E"], PHI:["#E81828","#002D72"],
  PIT:["#27251F","#FDB827"], SD:["#2F241D","#FFC425"], SF:["#FD5A1E","#27251F"],
  SEA:["#0C2C56","#005C5C"], STL:["#C41E3A","#0C2340"], TB:["#092C5C","#8FBCE6"],
  TEX:["#003278","#C0111F"], TOR:["#134A8E","#1D2D5C"], WSH:["#AB0003","#14225A"]
};

// NOTE: the real PLAYERS object (all 30 teams, every era) is defined in
// data-rosters.js, which loads right after this file. Do NOT declare PLAYERS
// here — a second `const PLAYERS` would be a duplicate declaration and crash
// the page before any buttons get wired up.
