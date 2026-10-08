# MLB Draft Duel

A browser-based head-to-head MLB draft game. A team is rolled each round and you
draft a real MLB player for an open lineup slot; the highest-rated lineup wins.
Play against the computer or pass-and-play. Includes a guess-the-player Trivia mode.

**Six eras:** 2020s, 2010s, 2000s, 1990s, 1980s, 1970s — 30 franchises, hundreds of
real players.

## Play it

It's a fully static site — no server, no build step. Just open `index.html` in a
browser, or host the folder anywhere static files are served.

## Files

- `index.html` — the game UI
- `game.js` — game logic (drafting, lineups, scoring, trivia)
- `data.js` — teams, eras, team colors
- `data-rosters.js` — generated roster + ratings data

That's the entire deployable site. Everything in the project root above this folder
(the `*.py` files) is the **data pipeline** that generates `data-rosters.js` — it is
not needed to run or host the game.

## Ratings

Ratings are derived from real, public, era-adjusted career stats: a blend of peak
rate (OPS+ / ERA+) and career WAR, with award finishes (MVP / Cy Young, derived from
a year-by-year table) as a tiebreaker. Era-adjusted stats keep every decade on one
fair scale. No official MLB logos are used — teams are shown with original colored
abbreviation badges.
