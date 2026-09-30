import { SudokuLanding } from "@/features/games/sudoku-landing";

export const metadata = {
  title: "Sudoku Battle | Rally",
  description:
    "Sudoku Battle is a free online multiplayer Sudoku game where 1–4 players race to solve the same puzzle.",
};

export default function SudokuBattlePage() {
  return <SudokuLanding />;
}
