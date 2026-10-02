import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Games | Free Online Multiplayer Games",
  description:
    "Explore Rally's free online multiplayer games. Play racing, combat, cards, drawing, strategy, board, and classic games with friends in private rooms.",
  keywords: [
    "online multiplayer games",
    "games to play with friends online",
    "free online games",
    "free multiplayer games",
    "multiplayer mini games",
    "browser games",
    "online games with friends",
    "private multiplayer games",
    "party games online",
    "Rally games",
    "Rally Racing",
    "Rally Combat",
    "Rally Cards",
    "Skribbl Draw and Guess",
    "Dots and Boxes",
    "Rock Paper Scissors online",
    "Number Hunt",
    "Memory Match",
    "Mini Golf online",
    "Battleship online",
    "Tic Tac Toe online",
    "Connect Four online",
    "Ludo online",
    "Emoji Decode",
    "emoji puzzles with friends",
    "Chess online",
    "Sudoku Battle online",
    "Mancala online",
  ],
  alternates: {
    canonical: "https://rallygames.vercel.app/games",
  },
  openGraph: {
    title: "Rally Games | Free Online Multiplayer Games",
    description:
      "Play free online multiplayer games with your friends. Race, fight, draw, strategize, and compete in Rally's growing collection of games.",
    url: "https://rallygames.vercel.app/games",
    type: "website",
    siteName: "Rally",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rally Games | Free Online Multiplayer Games",
    description:
      "Play free online multiplayer games with friends. Race, fight, draw, strategize, and compete on Rally.",
  },
};

const games = [
  {
    icon: "⚔️",
    image: "/images/games/rally-combat.jpg",
    title: "Rally Combat",
    description:
      "A 3D multiplayer fighting game. Pick your fighter, land combos, dodge attacks, and be the last one standing in the arena.",
    players: "2–4 players",
    category: "3D Brawler",
  },
  {
    icon: "🏎️",
    image: "/images/games/rally-racing.jpg",
    title: "Rally Racing",
    description:
      "Real-time 3D arcade racing. Drift around dirt trails, hit checkpoints, and race your friends to the finish line.",
    players: "2–4 players",
    category: "3D Arcade",
  },
  {
    icon: "🃏",
    image: "/images/games/rally-cards.jpg",
    title: "Rally Cards",
    description:
      "Match colors and numbers, play skips, reverses, and wild cards, and battle your friends in fast multiplayer card games.",
    players: "2–4 players",
    category: "Cards",
  },
  {
    icon: "🎨",
    image: "/images/games/skribbl.jpg",
    title: "Skribbl Draw & Guess",
    description:
      "Pick a word, draw it on the canvas, and guess what your friends are drawing before time runs out.",
    players: "2–4 players",
    category: "Drawing",
  },
  {
    icon: "🧩✨",
    image: "/images/games/emoji-decode.jpg",
    title: "Emoji Decode",
    description:
      "Decode fresh AI-generated emoji clues and race your friends to the answer in eight fast rounds.",
    players: "2–4 players",
    category: "Party / Guessing",
  },
  {
    icon: "♟",
    image: "/images/games/chess.svg",
    title: "Chess",
    description: "Challenge a friend to a battle of strategy. Every move counts.",
    players: "2 players",
    category: "Strategy",
  },
  {
    icon: "🔢",
    image: "/images/games/sudoku-battle.svg",
    title: "Sudoku Battle",
    description:
      "Race your friends or a Rally bot to solve the same Sudoku puzzle. Fill the grid accurately before time runs out.",
    players: "1–4 players",
    category: "Puzzle / Race",
  },
  {
    icon: "🔲",
    image: "/images/games/dots-boxes.svg",
    title: "Dots & Boxes",
    description:
      "Take turns connecting dots to claim boxes and capture the grid. Complete the most boxes to win.",
    players: "2–4 players",
    category: "Strategy",
  },
  {
    icon: "✊",
    image: "/images/games/rock-paper-scissors.svg",
    title: "Rock Paper Scissors",
    description:
      "Make your secret pick, reveal it at the same time, and outsmart your opponent in the classic quick-fire duel.",
    players: "2 players",
    category: "Classic",
  },
  {
    icon: "🔎",
    image: "/images/games/number-hunt.svg",
    title: "Number Hunt",
    description:
      "A fast number challenge where players choose tiles and try to find the hidden target while earning points.",
    players: "2–4 players",
    category: "Grid Rush",
  },
  {
    icon: "🧠",
    image: "/images/games/memory-match.svg",
    title: "Memory Match",
    description:
      "Flip cards, find matching pairs, and build the biggest memory streak before your opponents.",
    players: "2–4 players",
    category: "Memory",
  },
  {
    icon: "⛳",
    image: "/images/games/mini-golf.svg",
    title: "Mini Golf",
    description:
      "Aim, choose your power, avoid hazards, and finish the course with the lowest score.",
    players: "2–4 players",
    category: "Live",
  },
  {
    icon: "🚢",
    image: "/images/games/battleship.svg",
    title: "Battleship",
    description:
      "Take turns firing at hidden coordinates and try to sink your opponent's fleet before they find yours.",
    players: "2 players",
    category: "Duel",
  },
  {
    icon: "⭕",
    image: "/images/games/tic-tac-toe.svg",
    title: "Tic-Tac-Toe",
    description:
      "The timeless three-in-a-row duel. Place your marks, create a line, and beat your opponent.",
    players: "2 players",
    category: "Classic",
  },
  {
    icon: "🔴",
    image: "/images/games/connect-four.svg",
    title: "Connect Four",
    description:
      "Drop discs into the grid, connect four before your opponent, and block their winning move.",
    players: "2 players",
    category: "Strategy",
  },
  {
    icon: "🎲",
    image: "/images/games/ludo.svg",
    title: "Ludo",
    description:
      "Race your tokens around the board, send rivals home, and get all your pieces to the finish first.",
    players: "2–4 players",
    category: "Board Game",
  },
  {
    icon: "🪨",
    image: "/images/games/mancala.svg",
    title: "Mancala",
    description: "Classic stones. Smart moves. One winner.",
    players: "2 players",
    category: "Board Game",
  },
];

export default function GamesPage() {
  return (
    <main className="min-h-screen bg-[#fbfbfe] px-5 py-12 pb-24 md:py-16">
      <div className="mx-auto max-w-6xl">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-bold text-violet-600 transition hover:text-violet-700"
        >
          ← Back to Rally
        </Link>

        {/* Hero */}
        <section className="mt-12 max-w-4xl">
          <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-violet-600">
            Rally Games
          </p>

          <h1 className="mt-4 text-5xl font-black leading-[0.95] tracking-[-0.05em] text-slate-950 md:text-7xl">
            Pick a game.
            <br />
            <span className="text-violet-600">Call your friends.</span>
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-500 md:text-xl">
            Discover free online multiplayer games on Rally. Race, fight,
            draw, strategize, and compete with your friends in quick games
            designed for 2–4 players.
          </p>
        </section>

        {/* Game collection */}
        <section
          aria-labelledby="rally-games-heading"
          className="mt-14"
        >
          <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-violet-600">
                The collection
              </p>

              <h2
                id="rally-games-heading"
                className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-4xl"
              >
                What are we playing?
              </h2>
            </div>

            <p className="text-sm font-semibold text-slate-400">
              {games.length} games and growing
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game, index) => {
              const card = <article
                key={game.title}
                className="group flex min-h-[340px] flex-col rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl"
              >
                {/* Image + category */}
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-slate-900 shadow-sm">
                  <img
                    src={game.image}
                    alt={game.title}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute top-3 stroke-slate-900 left-3 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950/65 text-lg text-white backdrop-blur-md">
                    {game.icon}
                  </div>
                  <span className="absolute top-3 right-3 rounded-full border border-white/20 bg-slate-950/70 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white backdrop-blur-md">
                    {game.category}
                  </span>
                </div>

                {/* Game information */}
                <div className="mt-5">
                  <h3 className="text-2xl font-black tracking-tight text-slate-950">
                    {game.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {game.description}
                  </p>
                </div>

                {/* Footer */}
                <div className="mt-auto flex items-center justify-between border-t border-slate-200 pt-4">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                    {game.players}
                  </span>

                  <span className="text-xs font-black text-slate-300">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
              </article>;
              return game.title === "Emoji Decode" || game.title === "Chess" || game.title === "Sudoku Battle" || game.title === "Mancala" ? (
                <Link key={game.title} href={game.title === "Chess" ? "/games/chess" : game.title === "Sudoku Battle" ? "/games/sudoku-battle" : game.title === "Mancala" ? "/games/mancala" : "/games/emoji-decode"} className="block rounded-[28px] focus-visible:outline-4 focus-visible:outline-violet-500">{card}</Link>
              ) : card;
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 overflow-hidden rounded-[32px] bg-slate-950 p-8 text-white md:p-12">
          <div className="max-w-3xl">
            <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-violet-400">
              Ready to play?
            </p>

            <h2 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
              Create a room.
              <br />
              Call your friends.
            </h2>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 md:text-lg">
              Choose a game, create a private room, share the room with your
              friends, and start playing together online.
            </p>

            <Link
              href="/auth?mode=signup"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-violet-600 px-7 py-3.5 font-bold transition hover:bg-violet-500"
            >
              Start playing
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        {/* SEO content */}
        <section className="mt-16 max-w-4xl">
          <h2 className="text-3xl font-black tracking-tight text-slate-950">
            Free online multiplayer games with friends
          </h2>

          <div className="mt-5 space-y-5 text-base leading-7 text-slate-600">
            <p>
              Rally is a collection of quick online multiplayer games built
              for playing with friends. Create a private room, invite your
              friends, and jump into a game directly from your browser.
            </p>

            <p>
              Whether you want a quick game of Rock Paper Scissors, a strategy
              match of Connect Four or Dots & Boxes, a game of Ludo, a round of
              Battleship, or something more competitive like Rally Racing and
              Rally Combat, Rally gives you different ways to play together
              online.
            </p>

            <p>
              Rally also includes drawing and guessing with Skribbl Draw &
              Guess, card games with Rally Cards, Memory Match, Number Hunt,
              Mini Golf, Tic-Tac-Toe, and more games as the platform grows.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
