"use client";

import type { GameKey } from "./registry";

type Props = {
  gameKey: GameKey | string;
  className?: string;
  size?: number;
  title?: string;
};

/** Clean geometric SVG mark for each Rally game (replaces emoji icons). */
export function GameIcon({ gameKey, className = "", size = 28, title }: Props) {
  const s = size;
  const common = {
    width: s,
    height: s,
    viewBox: "0 0 48 48",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className,
    "aria-hidden": title ? undefined : true,
    role: title ? ("img" as const) : undefined,
  };

  const stroke = "currentColor";

  switch (gameKey) {
    case "tower_rush":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <rect x="16" y="8" width="16" height="32" rx="2" stroke={stroke} strokeWidth="2.5" />
          <rect x="12" y="14" width="6" height="4" rx="1" fill={stroke} />
          <rect x="30" y="14" width="6" height="4" rx="1" fill={stroke} />
          <rect x="12" y="24" width="6" height="4" rx="1" fill={stroke} />
          <rect x="30" y="24" width="6" height="4" rx="1" fill={stroke} />
          <path d="M20 8V4h8v4" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M18 40h12v4H18z" fill={stroke} />
          <circle cx="24" cy="20" r="2" fill={stroke} />
          <circle cx="24" cy="28" r="2" fill={stroke} />
        </svg>
      );

    case "hex_fall":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <path
            d="M24 6 L40 15 V33 L24 42 L8 33 V15 Z"
            stroke={stroke}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M24 16 L32 20.5 V29.5 L24 34 L16 29.5 V20.5 Z" stroke={stroke} strokeWidth="2" />
          <path d="M24 22v6M21 25h6" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case "rally_combat":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <path d="M12 10 L20 18 L16 22 L8 14 Z" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M36 10 L28 18 L32 22 L40 14 Z" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M18 20 L30 32" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M30 20 L18 32" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="24" cy="26" r="3.5" stroke={stroke} strokeWidth="2" />
          <path d="M14 36h20" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case "racing":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <path
            d="M8 28c2-8 8-12 16-12s14 4 16 12"
            stroke={stroke}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path d="M10 28h28v4H10z" fill={stroke} opacity="0.25" />
          <rect x="12" y="24" width="24" height="8" rx="3" stroke={stroke} strokeWidth="2.2" />
          <circle cx="16" cy="34" r="3.5" stroke={stroke} strokeWidth="2.2" />
          <circle cx="32" cy="34" r="3.5" stroke={stroke} strokeWidth="2.2" />
          <path d="M18 20h12l3 4H15l3-4z" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
          <path d="M22 14h4v4h-4z" fill={stroke} />
        </svg>
      );

    case "uno":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <rect x="10" y="10" width="18" height="26" rx="3" stroke={stroke} strokeWidth="2.2" transform="rotate(-8 19 23)" />
          <rect x="16" y="8" width="18" height="26" rx="3" stroke={stroke} strokeWidth="2.2" fill="currentColor" fillOpacity="0.08" />
          <circle cx="25" cy="21" r="5" stroke={stroke} strokeWidth="2" />
          <path d="M23 19l4 4M27 19l-4 4" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );

    case "skribbl":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <path d="M8 32c4-10 12-16 20-18" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M28 12l8 8-16 16H12V28l16-16z" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M26 14l8 8" stroke={stroke} strokeWidth="2" />
          <circle cx="14" cy="36" r="3" stroke={stroke} strokeWidth="2" />
          <path d="M18 36h14" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case "emoji_decode":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <path
            d="M18 10h12l4 6v16l-4 6H18l-4-6V16l4-6z"
            stroke={stroke}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path d="M18 24h12M24 18v12" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="20" cy="16" r="1.5" fill={stroke} />
          <circle cx="28" cy="32" r="1.5" fill={stroke} />
        </svg>
      );

    case "sudoku_battle":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <rect x="8" y="8" width="32" height="32" rx="3" stroke={stroke} strokeWidth="2.2" />
          <path d="M8 18.5h32M8 29.5h32M18.5 8v32M29.5 8v32" stroke={stroke} strokeWidth="1.8" />
          <path d="M14 14h4v4h-4zM25 25h4v4h-4zM34 14h4v4h-4z" fill={stroke} opacity="0.7" />
        </svg>
      );

    case "chess":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <path
            d="M24 6c2 0 4 2 4 5 0 2-1 3-2 4h6c1 0 2 1 2 2v2H14v-2c0-1 1-2 2-2h6c-1-1-2-2-2-4 0-3 2-5 4-5z"
            stroke={stroke}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path d="M16 19h16l-2 14H18L16 19z" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M14 35h20v4H14z" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M22 10h4" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case "dots_boxes":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <circle cx="12" cy="12" r="2.5" fill={stroke} />
          <circle cx="24" cy="12" r="2.5" fill={stroke} />
          <circle cx="36" cy="12" r="2.5" fill={stroke} />
          <circle cx="12" cy="24" r="2.5" fill={stroke} />
          <circle cx="24" cy="24" r="2.5" fill={stroke} />
          <circle cx="36" cy="24" r="2.5" fill={stroke} />
          <circle cx="12" cy="36" r="2.5" fill={stroke} />
          <circle cx="24" cy="36" r="2.5" fill={stroke} />
          <circle cx="36" cy="36" r="2.5" fill={stroke} />
          <path d="M12 12h12M24 12v12M12 24h12M12 12v12" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <rect x="12" y="12" width="12" height="12" fill={stroke} fillOpacity="0.15" />
        </svg>
      );

    case "rps":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <path
            d="M16 22c0-4 3-7 8-7s8 3 8 7v10c0 4-3 7-8 7s-8-3-8-7V22z"
            stroke={stroke}
            strokeWidth="2.2"
          />
          <path d="M18 20v-4a2 2 0 014 0v4M26 20v-5a2 2 0 014 0v5M22 20v-6a2 2 0 014 0" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <path d="M14 28h4M30 28h4" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case "number_guess":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <circle cx="20" cy="20" r="10" stroke={stroke} strokeWidth="2.5" />
          <path d="M27 27l10 10" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M16 18h2v6M20 18v6" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <path d="M16 24h8" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case "memory_match":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <rect x="8" y="12" width="14" height="20" rx="2" stroke={stroke} strokeWidth="2.2" />
          <rect x="26" y="12" width="14" height="20" rx="2" stroke={stroke} strokeWidth="2.2" />
          <path d="M12 20h6M12 24h6M30 20h6M30 24h6" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="15" cy="16" r="1.5" fill={stroke} />
          <circle cx="33" cy="16" r="1.5" fill={stroke} />
        </svg>
      );

    case "mini_golf":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <path d="M16 40V12" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M16 12l16 6-16 6V12z" fill={stroke} fillOpacity="0.85" />
          <circle cx="30" cy="36" r="4" stroke={stroke} strokeWidth="2.2" />
          <path d="M8 40h32" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <circle cx="34" cy="36" r="1.2" fill={stroke} />
        </svg>
      );

    case "battleship":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <path d="M8 30h32l-4 6H12l-4-6z" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M12 30V18h6v4h8v-6h6v14" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M22 16v-4M26 16v-6" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <path d="M6 38c4-2 8-2 12 0s8 2 12 0 8-2 12 0" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case "tic_tac_toe":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <path d="M16 8v32M32 8v32M8 16h32M8 32h32" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M10 10l8 8M18 10l-8 8" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="32" cy="24" r="5" stroke={stroke} strokeWidth="2.2" />
        </svg>
      );

    case "connect_four":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <rect x="8" y="10" width="32" height="30" rx="3" stroke={stroke} strokeWidth="2.2" />
          <circle cx="16" cy="20" r="3.5" stroke={stroke} strokeWidth="2" />
          <circle cx="24" cy="20" r="3.5" fill={stroke} />
          <circle cx="32" cy="20" r="3.5" stroke={stroke} strokeWidth="2" />
          <circle cx="16" cy="30" r="3.5" fill={stroke} />
          <circle cx="24" cy="30" r="3.5" stroke={stroke} strokeWidth="2" />
          <circle cx="32" cy="30" r="3.5" fill={stroke} />
          <path d="M24 6v4" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    case "ludo":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <rect x="10" y="10" width="28" height="28" rx="5" stroke={stroke} strokeWidth="2.5" />
          <circle cx="18" cy="18" r="2.5" fill={stroke} />
          <circle cx="30" cy="18" r="2.5" fill={stroke} />
          <circle cx="24" cy="24" r="2.5" fill={stroke} />
          <circle cx="18" cy="30" r="2.5" fill={stroke} />
          <circle cx="30" cy="30" r="2.5" fill={stroke} />
        </svg>
      );

    case "mancala":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <ellipse cx="10" cy="24" rx="5" ry="10" stroke={stroke} strokeWidth="2.2" />
          <ellipse cx="38" cy="24" rx="5" ry="10" stroke={stroke} strokeWidth="2.2" />
          <rect x="14" y="14" width="20" height="20" rx="3" stroke={stroke} strokeWidth="2.2" />
          <circle cx="19" cy="20" r="2" fill={stroke} />
          <circle cx="25" cy="20" r="2" fill={stroke} />
          <circle cx="31" cy="20" r="2" fill={stroke} />
          <circle cx="19" cy="28" r="2" fill={stroke} />
          <circle cx="25" cy="28" r="2" fill={stroke} />
          <circle cx="31" cy="28" r="2" fill={stroke} />
        </svg>
      );

    case "basketball":
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <circle cx="24" cy="24" r="14" stroke={stroke} strokeWidth="2.5" />
          <path d="M10 24h28M24 10c4 4 4 20 0 28M24 10c-4 4-4 20 0 28" stroke={stroke} strokeWidth="2" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          {title ? <title>{title}</title> : null}
          <rect x="10" y="14" width="28" height="22" rx="4" stroke={stroke} strokeWidth="2.5" />
          <path d="M16 14v-2a8 8 0 0116 0v2" stroke={stroke} strokeWidth="2.5" />
          <circle cx="24" cy="25" r="3" fill={stroke} />
        </svg>
      );
  }
}

/** Map display title → GameKey for static marketing lists */
export const titleToGameKey: Record<string, GameKey | string> = {
  "Rally Tower Rush": "tower_rush",
  "Tower Rush": "tower_rush",
  "Hex Fall 3D": "hex_fall",
  "Hex Fall": "hex_fall",
  "Rally Combat": "rally_combat",
  "Rally Racing": "racing",
  Racing: "racing",
  "Rally Cards": "uno",
  Uno: "uno",
  Skribbl: "skribbl",
  "Skribbl Draw & Guess": "skribbl",
  "Draw & Guess": "skribbl",
  "Emoji Decode": "emoji_decode",
  "Sudoku Battle": "sudoku_battle",
  Sudoku: "sudoku_battle",
  Chess: "chess",
  "Dots & Boxes": "dots_boxes",
  "Rock Paper Scissors": "rps",
  RPS: "rps",
  "Number Hunt": "number_guess",
  "Memory Match": "memory_match",
  "Mini Golf": "mini_golf",
  Battleship: "battleship",
  "Tic-Tac-Toe": "tic_tac_toe",
  "Connect Four": "connect_four",
  Ludo: "ludo",
  Mancala: "mancala",
  Basketball: "basketball",
};
