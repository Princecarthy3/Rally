export type GameKey = "basketball" | "ping_pong" | "rps" | "number_guess" | "tic_tac_toe" | "dice_dash" | "quick_quiz" | "emoji_decode" | "dots_boxes" | "skribbl";

export type GameDefinition = {
  key: GameKey; name: string; shortName: string; icon: string; description: string;
  players: string; minPlayers: number; maxPlayers: number; color: string; ink: string; tag: string;
};

export const games: GameDefinition[] = [
  { key:"basketball", name:"Pocket Basketball", shortName:"Basketball", icon:"🏀", description:"Five pressure shots each. Server-rolled swishes, no home-court advantage.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#ffb563", ink:"#5b2b00", tag:"Hot" },
  { key:"ping_pong", name:"Neon Ping Pong", shortName:"Ping Pong", icon:"🏓", description:"Live paddles, quick reflexes, first player to five points wins.", players:"2", minPlayers:2, maxPlayers:2, color:"#8de2bd", ink:"#083d2a", tag:"Live" },
  { key:"rps", name:"Rock Paper Scissors", shortName:"RPS", icon:"✊", description:"Secret picks, dramatic reveals, and room for a four-way upset.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#c9b8ff", ink:"#30206c", tag:"Classic" },
  { key:"number_guess", name:"Number Hunt", shortName:"Number Hunt", icon:"🔢", description:"Chase the hidden number with hot-and-cold clues before your friends do.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#9fcaff", ink:"#123967", tag:"Clever" },
  { key:"tic_tac_toe", name:"Tic-Tac-Toe", shortName:"Tic-Tac-Toe", icon:"⭕", description:"The timeless three-in-a-row duel, sharpened for quick rematches.", players:"2", minPlayers:2, maxPlayers:2, color:"#ff9eaa", ink:"#651927", tag:"Duel" },
  { key:"dots_boxes", name:"Dots & Boxes", shortName:"Dots & Boxes", icon:"🔲", description:"Take turns connecting dots to claim boxes and capture the grid.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#bbf7d0", ink:"#14532d", tag:"Strategy" },
  { key:"skribbl", name:"Skribbl Draw & Guess", shortName:"Skribbl", icon:"🎨", description:"Pick a word, draw on the live canvas, and guess what friends are drawing.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#fef08a", ink:"#713f12", tag:"Popular" },
  { key:"dice_dash", name:"Dice Dash", shortName:"Dice Dash", icon:"🎲", description:"Race to square twenty. Rolls are server-side; celebrations are all yours.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#f4dc69", ink:"#4c3d00", tag:"Party" },
  { key:"quick_quiz", name:"Quick Draw Trivia", shortName:"Quick Quiz", icon:"⚡", description:"Five fast questions. Lock your answer before the room catches up.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#77dce7", ink:"#07454b", tag:"Party" },
  { key:"emoji_decode", name:"Emoji Guessing", shortName:"Emoji Guess", icon:"🧩", description:"Decode movies, songs, celebs, and games from dynamic emoji clues.", players:"2–4", minPlayers:2, maxPlayers:4, color:"#f2a8df", ink:"#5c164c", tag:"Dynamic" },
];

export const gameByKey = Object.fromEntries(games.map(game => [game.key, game])) as Record<GameKey, GameDefinition>;
