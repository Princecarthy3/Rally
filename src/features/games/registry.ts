export type GameKey = "rps" | "number_guess" | "tic_tac_toe" | "uno" | "dots_boxes" | "skribbl";

export type GameDefinition = {
  key: GameKey; name: string; shortName: string; icon: string; description: string;
  players: string; minPlayers: number; maxPlayers: number; color: string; ink: string; tag: string;
};

export const games: GameDefinition[] = [
  { key:"uno", name:"UNO Cards", shortName:"UNO", icon:"🃏", description:"Match colors and numbers, play Skip, Reverse & Draw 2 cards, and call UNO to win!", players:"2–4", minPlayers:2, maxPlayers:4, color:"#ef4444", ink:"#ffffff", tag:"Popular" },
  { key:"skribbl", name:"Skribbl Draw & Guess", shortName:"Skribbl", icon:"🎨", description:"Pick a word, draw on the live canvas, and guess what friends are drawing.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#fef08a", ink:"#713f12", tag:"Popular" },
  { key:"dots_boxes", name:"Dots & Boxes", shortName:"Dots & Boxes", icon:"🔲", description:"Take turns connecting dots to claim boxes and capture the grid.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#bbf7d0", ink:"#14532d", tag:"Strategy" },
  { key:"rps", name:"Rock Paper Scissors", shortName:"RPS", icon:"✊", description:"Secret picks, dramatic reveals, and room for a four-way upset.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#c9b8ff", ink:"#30206c", tag:"Classic" },
  { key:"number_guess", name:"Number Hunt", shortName:"Number Hunt", icon:"🔢", description:"Secret number duel with 5-second countdown & hot-and-cold clues!", players:"2–4", minPlayers:2, maxPlayers:4, color:"#9fcaff", ink:"#123967", tag:"5s Duel" },
  { key:"tic_tac_toe", name:"Tic-Tac-Toe", shortName:"Tic-Tac-Toe", icon:"⭕", description:"The timeless three-in-a-row duel, sharpened for 3-round battles.", players:"2", minPlayers:2, maxPlayers:2, color:"#ff9eaa", ink:"#651927", tag:"Duel" },
];

export const gameByKey = Object.fromEntries(games.map(game => [game.key, game])) as Record<GameKey, GameDefinition>;

