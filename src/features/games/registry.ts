export type GameKey = "rps" | "number_guess" | "trivia_clash" | "memory_match" | "tic_tac_toe" | "connect_four" | "dots_boxes" | "skribbl" | "ludo";

export type GameDefinition = {
  key: GameKey; name: string; shortName: string; icon: string; description: string;
  players: string; minPlayers: number; maxPlayers: number; color: string; ink: string; tag: string;
};

export const games: GameDefinition[] = [
  { key:"skribbl", name:"Skribbl Draw & Guess", shortName:"Skribbl", icon:"🎨", description:"Pick a word, draw on the live canvas, and guess what friends are drawing.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#fef08a", ink:"#713f12", tag:"Popular" },
  { key:"dots_boxes", name:"Dots & Boxes", shortName:"Dots & Boxes", icon:"🔲", description:"Take turns connecting dots to claim boxes and capture the grid.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#bbf7d0", ink:"#14532d", tag:"Strategy" },
  { key:"rps", name:"Rock Paper Scissors", shortName:"RPS", icon:"✊", description:"Secret picks, dramatic reveals, and room for a four-way upset.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#c9b8ff", ink:"#30206c", tag:"Classic" },
  { key:"number_guess", name:"Number Hunt", shortName:"Number Hunt", icon:"🔎", description:"A five-round 1–25 grid hunt: every player locks a tile, and finding the hidden number earns 100 points.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#9fcaff", ink:"#123967", tag:"Grid Rush" },
  { key:"trivia_clash", name:"Trivia Clash", shortName:"Trivia Clash", icon:"🧠", description:"Race through five fast trivia questions and score points for every correct answer.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#f0c7ff", ink:"#5b176d", tag:"Quick Quiz" },
  { key:"memory_match", name:"Memory Match", shortName:"Memory Match", icon:"🃏", description:"Flip cards, find matching pairs, and build the biggest memory streak.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#ffd6a5", ink:"#7c2d12", tag:"Memory" },
  { key:"tic_tac_toe", name:"Tic-Tac-Toe", shortName:"Tic-Tac-Toe", icon:"⭕", description:"The timeless three-in-a-row duel, sharpened for 3-round battles.", players:"2", minPlayers:2, maxPlayers:2, color:"#ff9eaa", ink:"#651927", tag:"Duel" },
  { key:"connect_four", name:"Connect Four", shortName:"Connect Four", icon:"🔴", description:"Drop discs, line up four, and block your rival before they connect.", players:"2", minPlayers:2, maxPlayers:2, color:"#fdb4d5", ink:"#741b47", tag:"Strategy" },
  { key:"ludo", name:"Ludo", shortName:"Ludo", icon:"🎲", description:"Race four tokens around the board, send rivals home, and finish every piece first.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#f4dc69", ink:"#5b3a00", tag:"Board Game" },
];

export const gameByKey = Object.fromEntries(games.map(game => [game.key, game])) as Record<GameKey, GameDefinition>;
