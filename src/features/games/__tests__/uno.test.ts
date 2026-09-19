export interface UnoCard {
  id: string;
  color: "red" | "blue" | "green" | "yellow" | "wild";
  value: string;
}

export function generateUnoDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  const colors: Array<"red" | "blue" | "green" | "yellow"> = ["red", "blue", "green", "yellow"];
  let id = 1;

  colors.forEach((color) => {
    // 0 x1
    deck.push({ id: `c${id++}`, color, value: "0" });
    // 1-9 x2
    for (let i = 1; i <= 9; i++) {
      deck.push({ id: `c${id++}`, color, value: String(i) });
      deck.push({ id: `c${id++}`, color, value: String(i) });
    }
    // Skip x2
    deck.push({ id: `c${id++}`, color, value: "skip" });
    deck.push({ id: `c${id++}`, color, value: "skip" });
    // Reverse x2
    deck.push({ id: `c${id++}`, color, value: "reverse" });
    deck.push({ id: `c${id++}`, color, value: "reverse" });
    // Draw Two x2
    deck.push({ id: `c${id++}`, color, value: "draw2" });
    deck.push({ id: `c${id++}`, color, value: "draw2" });
  });

  // Wild x4
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `c${id++}`, color: "wild", value: "wild" });
  }

  // Wild Draw Four x4
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `c${id++}`, color: "wild", value: "wild_draw4" });
  }

  return deck;
}

export function calculateRoundScore(opponentsHands: UnoCard[][]): number {
  let score = 0;
  opponentsHands.forEach((hand) => {
    hand.forEach((card) => {
      if (card.value === "wild" || card.value === "wild_draw4") {
        score += 50;
      } else if (card.value === "skip" || card.value === "reverse" || card.value === "draw2") {
        score += 20;
      } else {
        score += parseInt(card.value, 10) || 0;
      }
    });
  });
  return score;
}

export function isPlayableCard(card: UnoCard, activeColor: string, topCardValue: string): boolean {
  if (card.color === "wild") return true;
  if (card.color === activeColor) return true;
  if (card.value === topCardValue) return true;
  return false;
}

export function isWildDraw4Bluff(hand: UnoCard[], activeColor: string): boolean {
  return hand.some((card) => card.color === activeColor);
}

export function runUnoTests(): boolean {
  // Test 1: Deck size 108
  const deck = generateUnoDeck();
  if (deck.length !== 108) throw new Error(`Expected 108 cards, got ${deck.length}`);

  // Test 2: Color counts
  const colorsCount = { red: 0, blue: 0, green: 0, yellow: 0, wild: 0 };
  deck.forEach((c) => colorsCount[c.color]++);
  if (colorsCount.red !== 25 || colorsCount.blue !== 25 || colorsCount.green !== 25 || colorsCount.yellow !== 25 || colorsCount.wild !== 8) {
    throw new Error("Invalid card distribution in deck");
  }

  // Test 3: Card playability
  if (!isPlayableCard({ id: "1", color: "red", value: "7" }, "red", "3")) throw new Error("Color match failed");
  if (!isPlayableCard({ id: "2", color: "blue", value: "7" }, "red", "7")) throw new Error("Value match failed");
  if (!isPlayableCard({ id: "3", color: "wild", value: "wild" }, "yellow", "2")) throw new Error("Wild match failed");
  if (isPlayableCard({ id: "4", color: "blue", value: "4" }, "red", "9")) throw new Error("Invalid card accepted");

  // Test 4: Wild Draw 4 bluff detection
  if (!isWildDraw4Bluff([{ id: "1", color: "red", value: "3" }], "red")) throw new Error("Bluff detection failed");
  if (isWildDraw4Bluff([{ id: "1", color: "blue", value: "3" }], "red")) throw new Error("False bluff detected");

  // Test 5: Score calculation
  const score = calculateRoundScore([[
    { id: "1", color: "red", value: "5" },
    { id: "2", color: "blue", value: "skip" },
    { id: "3", color: "wild", value: "wild" }
  ]]);
  if (score !== 75) throw new Error(`Expected score 75, got ${score}`);

  return true;
}

// Execute tests if run directly
if (typeof require !== "undefined" && require.main === module) {
  runUnoTests();
  console.log("ALL UNO TESTS PASSED PERFECTLY! 108 cards verified.");
}
