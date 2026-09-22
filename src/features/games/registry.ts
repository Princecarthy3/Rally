export type GameKey = "uno" | "rps" | "number_guess" | "memory_match" | "mini_golf" | "battleship" | "tic_tac_toe" | "connect_four" | "dots_boxes" | "skribbl" | "ludo" | "basketball" | "rally_racing";

export type GameDefinition = {
  key: GameKey; name: string; shortName: string; icon: string; description: string;
  players: string; minPlayers: number; maxPlayers: number; color: string; ink: string; tag: string;
};

export const games: GameDefinition[] = [
  { key:"uno", name:"UNO Classic", shortName:"UNO", icon:"🃏", description:"The classic 108-card matching game. Play colors, numbers, Skips, Reverses, and Wild cards!", players:"2–4", minPlayers:2, maxPlayers:4, color:"#ff8a8a", ink:"#7f1d1d", tag:"Classic" },
  { key:"skribbl", name:"Skribbl Draw & Guess", shortName:"Skribbl", icon:"🎨", description:"Pick a word, draw on the live canvas, and guess what friends are drawing.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#fef08a", ink:"#713f12", tag:"Popular" },
  { key:"dots_boxes", name:"Dots & Boxes", shortName:"Dots & Boxes", icon:"🔲", description:"Take turns connecting dots to claim boxes and capture the grid.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#bbf7d0", ink:"#14532d", tag:"Strategy" },
  { key:"rps", name:"Rock Paper Scissors", shortName:"RPS", icon:"✊", description:"Secret picks, dramatic reveals, and room for a four-way upset.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#c9b8ff", ink:"#30206c", tag:"Classic" },
  { key:"number_guess", name:"Number Hunt", shortName:"Number Hunt", icon:"🔎", description:"A five-round 1–25 grid hunt: every player locks a tile, and finding the hidden number earns 100 points.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#9fcaff", ink:"#123967", tag:"Grid Rush" },
  { key:"memory_match", name:"Memory Match", shortName:"Memory Match", icon:"🃏", description:"Flip cards, find matching pairs, and build the biggest memory streak.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#ffd6a5", ink:"#7c2d12", tag:"Memory" },
  { key:"mini_golf", name:"Mini Golf", shortName:"Mini Golf", icon:"⛳", description:"Live 2D putting: aim, release, dodge hazards, and finish nine holes with the lowest score.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#b9f3b2", ink:"#14532d", tag:"Live" },
  { key:"battleship", name:"Battleship", shortName:"Battleship", icon:"🚢", description:"Take turns firing at hidden coordinates and sink the rival fleet. Hits keep your turn.", players:"2", minPlayers:2, maxPlayers:2, color:"#bde3ff", ink:"#123967", tag:"Duel" },
  { key:"basketball", name:"Basketball", shortName:"Basketball", icon:"🏀", description:"Arcade hoops showdown: each player takes 10 shots in a row — pull back, release, and drain buckets.", players:"2", minPlayers:2, maxPlayers:2, color:"#fdba74", ink:"#7c2d12", tag:"Arcade" },
  { key:"rally_racing", name:"Rally Racing", shortName:"Racing", icon:"🏎️", description:"Arcade rally through Forest Run — checkpoints, countdown, and real-time multiplayer cars.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#86efac", ink:"#14532d", tag:"Racing" },
  { key:"tic_tac_toe", name:"Tic-Tac-Toe", shortName:"Tic-Tac-Toe", icon:"⭕", description:"The timeless three-in-a-row duel, sharpened for 3-round battles.", players:"2", minPlayers:2, maxPlayers:2, color:"#ff9eaa", ink:"#651927", tag:"Duel" },
  { key:"connect_four", name:"Connect Four", shortName:"Connect Four", icon:"🔴", description:"Drop discs, line up four, and block your rival before they connect.", players:"2", minPlayers:2, maxPlayers:2, color:"#fdb4d5", ink:"#741b47", tag:"Strategy" },
  { key:"ludo", name:"Ludo", shortName:"Ludo", icon:"🎲", description:"Race four tokens around the board, send rivals home, and finish every piece first.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#f4dc69", ink:"#5b3a00", tag:"Board Game" },
];

export const gameByKey = Object.fromEntries(games.map(game => [game.key, game])) as Record<GameKey, GameDefinition>;
