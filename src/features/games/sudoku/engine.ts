/** Deterministic Sudoku generator/solver with unique-solution validation. */

export type Difficulty = "easy" | "medium" | "hard";

export type SudokuGrid = number[]; // length 81, 0 = empty, 1-9 = digit

const DIFFICULTY_CLUES: Record<Difficulty, { min: number; max: number }> = {
  easy: { min: 38, max: 45 },
  medium: { min: 30, max: 37 },
  hard: { min: 24, max: 29 },
};

function idx(r: number, c: number) {
  return r * 9 + c;
}

export function emptyGrid(): SudokuGrid {
  return Array.from({ length: 81 }, () => 0);
}

export function cloneGrid(g: SudokuGrid): SudokuGrid {
  return g.slice();
}

export function isValidPlacement(grid: SudokuGrid, row: number, col: number, num: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (grid[idx(row, i)] === num) return false;
    if (grid[idx(i, col)] === num) return false;
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      if (grid[idx(r, c)] === num) return false;
    }
  }
  return true;
}

function findEmpty(grid: SudokuGrid): number {
  for (let i = 0; i < 81; i++) if (grid[i] === 0) return i;
  return -1;
}

function shuffledDigits(rng: () => number): number[] {
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums;
}

/** Mulberry32 PRNG for reproducible runs when seeded. */
export function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function fillGrid(grid: SudokuGrid, rng: () => number): boolean {
  const pos = findEmpty(grid);
  if (pos < 0) return true;
  const row = Math.floor(pos / 9);
  const col = pos % 9;
  for (const num of shuffledDigits(rng)) {
    if (isValidPlacement(grid, row, col, num)) {
      grid[pos] = num;
      if (fillGrid(grid, rng)) return true;
      grid[pos] = 0;
    }
  }
  return false;
}

/** Count solutions up to `limit` (use 2 to test uniqueness). */
export function countSolutions(grid: SudokuGrid, limit = 2): number {
  const g = cloneGrid(grid);
  let count = 0;
  function dfs(): boolean {
    if (count >= limit) return true;
    const pos = findEmpty(g);
    if (pos < 0) {
      count++;
      return count >= limit;
    }
    const row = Math.floor(pos / 9);
    const col = pos % 9;
    for (let num = 1; num <= 9; num++) {
      if (isValidPlacement(g, row, col, num)) {
        g[pos] = num;
        if (dfs()) {
          g[pos] = 0;
          return true;
        }
        g[pos] = 0;
      }
    }
    return false;
  }
  dfs();
  return count;
}

export function solve(grid: SudokuGrid): SudokuGrid | null {
  const g = cloneGrid(grid);
  const rng = createRng(1);
  if (!fillGrid(g, rng) && countSolutions(grid, 1) === 0) return null;
  // Prefer deterministic solve via ordered digits for stability
  const work = cloneGrid(grid);
  function dfs(): boolean {
    const pos = findEmpty(work);
    if (pos < 0) return true;
    const row = Math.floor(pos / 9);
    const col = pos % 9;
    for (let num = 1; num <= 9; num++) {
      if (isValidPlacement(work, row, col, num)) {
        work[pos] = num;
        if (dfs()) return true;
        work[pos] = 0;
      }
    }
    return false;
  }
  return dfs() ? work : null;
}

export function gridToString(grid: SudokuGrid): string {
  return grid.map((n) => String(n)).join("");
}

export function stringToGrid(s: string): SudokuGrid {
  const g = emptyGrid();
  for (let i = 0; i < 81 && i < s.length; i++) {
    const n = Number(s[i]);
    g[i] = n >= 1 && n <= 9 ? n : 0;
  }
  return g;
}

export function countFilled(grid: SudokuGrid): number {
  return grid.reduce((a, n) => a + (n > 0 ? 1 : 0), 0);
}

export function countCorrect(board: SudokuGrid, solution: SudokuGrid, puzzle: SudokuGrid): number {
  let n = 0;
  for (let i = 0; i < 81; i++) {
    if (puzzle[i] > 0) {
      n++;
      continue;
    }
    if (board[i] > 0 && board[i] === solution[i]) n++;
  }
  return n;
}

export function isComplete(board: SudokuGrid, solution: SudokuGrid): boolean {
  for (let i = 0; i < 81; i++) {
    if (board[i] !== solution[i]) return false;
  }
  return true;
}

export function hasLocalConflict(board: SudokuGrid, pos: number, num: number): boolean {
  if (num < 1 || num > 9) return false;
  const row = Math.floor(pos / 9);
  const col = pos % 9;
  const test = cloneGrid(board);
  test[pos] = 0;
  return !isValidPlacement(test, row, col, num);
}

/**
 * Generate a full solved board, then dig holes while preserving unique solution.
 */
export function generateSudoku(
  difficulty: Difficulty = "medium",
  seed = Date.now()
): { puzzle: SudokuGrid; solution: SudokuGrid } {
  const rng = createRng(seed >>> 0);
  const solution = emptyGrid();
  if (!fillGrid(solution, rng)) {
    // Extremely unlikely; retry with new seed
    return generateSudoku(difficulty, seed + 1);
  }

  const puzzle = cloneGrid(solution);
  const target = DIFFICULTY_CLUES[difficulty];
  const targetClues = target.min + Math.floor(rng() * (target.max - target.min + 1));

  const positions = Array.from({ length: 81 }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  for (const pos of positions) {
    if (countFilled(puzzle) <= targetClues) break;
    const backup = puzzle[pos];
    puzzle[pos] = 0;
    if (countSolutions(puzzle, 2) !== 1) {
      puzzle[pos] = backup;
    }
  }

  // Final safety: must still be uniquely solvable
  if (countSolutions(puzzle, 2) !== 1) {
    return generateSudoku(difficulty, seed + 97);
  }

  return { puzzle, solution };
}
