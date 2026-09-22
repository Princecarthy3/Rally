export interface EmojiPuzzle {
  question: string;
  options: string[];
  answer: number;
}

const FALLBACK_SKRIBBL_WORDS = [
  ["Apple", "Banana", "House"],
  ["Cat", "Dog", "Sun"],
  ["Moon", "Tree", "Car"],
  ["Fish", "Pizza", "Chair"],
  ["Book", "Phone", "Ball"],
  ["Shoe", "Hat", "Cloud"],
  ["Star", "Cake", "Toilet"],
  ["Vampire", "Ghost", "Robot"],
  ["Dinosaur", "Astronaut", "Pirate"],
  ["Mermaid", "Zombie", "Monkey"],
  ["Chicken", "Skateboard", "Sunglasses"],
  ["Toothbrush", "Backpack", "Wi-Fi"],
  ["Exam", "Procrastination", "Alien"],
  ["Time machine", "Broken heart", "Traffic jam"],
  ["Superhero", "Submarine", "Pikachu"],
  ["Telescope", "Watermelon", "Helicopter"],
  ["Hamburger", "Pyramid", "Spaghetti"],
];

const FALLBACK_EMOJI: EmojiPuzzle[] = [
  {
    question: "🦁 👑",
    options: ["Jungle Book", "Madagascar", "The Lion King", "Tarzan"],
    answer: 2,
  },
  {
    question: "🕷️ 👨",
    options: ["Spider-Man", "Ant-Man", "Batman", "Venom"],
    answer: 0,
  },
  {
    question: "👻 🚫",
    options: ["Casper", "Ghostbusters", "Poltergeist", "Beetlejuice"],
    answer: 1,
  },
  {
    question: "🚀 🌌 ⏳",
    options: ["Star Wars", "Interstellar", "Gravity", "Apollo 13"],
    answer: 1,
  },
  {
    question: "🦇 👨 🏙️",
    options: ["Daredevil", "Batman", "Iron Man", "Superman"],
    answer: 1,
  },
];

async function callOpenRouter(
  prompt: string,
  timeoutMs = 8000,
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error("OPENROUTER_API_KEY is not configured.");
    return null;
  }

  const models = [
    process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite",
    "openai/gpt-4o-mini",
  ];

  for (const model of models) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer":
              process.env.APP_URL || "http://localhost:3000",
            "X-Title": "Rally",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content:
                  "Return only valid JSON. Never use Markdown code fences.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            response_format: {
              type: "json_object",
            },
            max_tokens: 160,
            temperature: 0.7,
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();

        const text =
          data?.choices?.[0]?.message?.content;

        if (text) {
          return text;
        }
      } else {
        console.error(
          `OpenRouter API Error (${model}): ${response.status}`,
          await response.text(),
        );
      }
    } catch (error) {
      console.error(
        `OpenRouter API Error (${model}):`,
        error instanceof Error ? error.message : error,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

function cleanSkribblWords(
  value: unknown,
  excludedWords: string[],
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const excluded = new Set(
    excludedWords.map((word) =>
      word.trim().toLowerCase(),
    ),
  );

  return value
    .map((word) =>
      String(word ?? "")
        .trim()
        .replace(/^[\"']|[\"']$/g, ""),
    )
    .filter((word) => {
      const normalized = word.toLowerCase();

      return (
        word.length >= 2 &&
        word.length <= 32 &&
        !excluded.has(normalized) &&
        !/[{}<>\[\]|]/.test(word)
      );
    })
    .filter(
      (word, index, words) =>
        words.findIndex(
          (candidate) =>
            candidate.toLowerCase() === word.toLowerCase(),
        ) === index,
    );
}

/**
 * Generates 3 fresh AI-powered Skribbl words.
 *
 * The words are generated specifically for each game/round,
 * rather than always coming from the same static word bank.
 */
export type SkribblDifficulty = "easy" | "medium" | "hard";
export type SkribblCategory =
  | "random"
  | "animals"
  | "food"
  | "sports"
  | "technology"
  | "places"
  | "vehicles"
  | "objects"
  | "movies"
  | "games"
  | "nature"
  | "professions"
  | "pop_culture";

const DIFFICULTY_GUIDE: Record<SkribblDifficulty, string> = {
  easy: "Simple single nouns a child can draw (Apple, Dog, House).",
  medium: "Familiar multi-part things (Volcano, Roller Coaster, Astronaut).",
  hard: "Richer scenes or compound phrases (Time Machine, Haunted Mansion, Underwater City).",
};

export async function generateSkribblWordsAI(
  seed?: string,
  excludedWords: string[] = [],
  options?: {
    difficulty?: SkribblDifficulty;
    category?: SkribblCategory | string;
  },
): Promise<string[]> {
  const nonce = seed || crypto.randomUUID();
  const difficulty: SkribblDifficulty =
    options?.difficulty === "easy" || options?.difficulty === "hard"
      ? options.difficulty
      : "medium";
  const category = (options?.category || "random").toString().toLowerCase().replace(/\s+/g, "_");

  // Only send the most recent words to the AI (per-game used list).
  const recentWords = excludedWords.slice(-60);

  const excluded =
    recentWords.length > 0
      ? recentWords.join(", ")
      : "none";

  const prompt = `
Generate 3 unique words or short phrases for a multiplayer drawing game (Skribbl / Pictionary style).
Category: ${category === "random" ? "Random (mix of everyday drawable topics)" : category}
Difficulty: ${difficulty}
Difficulty guide: ${DIFFICULTY_GUIDE[difficulty]}

Rules:
- Every item must be drawable in under 80 seconds with simple lines.
- Do not use abstract concepts, politics, hate, sexual, or unsafe topics.
- Do not repeat any previously used words (case-insensitive).
- Do not generate close variations of previously used words (e.g. "cat" then "cats").
- Keep phrases short (1–3 words).
- The three options must be clearly different from each other.
- Recognizable to a general audience.
- Return ONLY valid JSON. No markdown. No commentary.

Previously used:
${JSON.stringify(recentWords)}

Game nonce (for variety across rooms): ${nonce}

Return exactly:
{
  "words": ["...", "...", "..."]
}
`;

  const responseText =
    await callOpenRouter(prompt);

  if (responseText) {
    try {
      const parsed = JSON.parse(responseText);

      // Normal expected response:
      // { words: ["...", "...", "..."] }
      const aiWords = cleanSkribblWords(
        parsed?.words,
        recentWords,
      );

      if (aiWords.length >= 3) {
        return aiWords.slice(0, 3);
      }

      // Backup in case the AI returns:
      // ["...", "...", "..."]
      const directWords =
        cleanSkribblWords(
          parsed,
          recentWords,
        );

      if (directWords.length >= 3) {
        return directWords.slice(0, 3);
      }
    } catch (error) {
      console.error(
        "Failed to parse AI Skribbl words:",
        error,
      );
    }
  }

  /*
   * Fallback if OpenRouter is unavailable.
   *
   * The nonce changes the starting position so every room
   * does not always receive the same first three choices.
   */
  const index =
    [...nonce].reduce(
      (total, character) =>
        total + character.charCodeAt(0),
      0,
    ) % FALLBACK_SKRIBBL_WORDS.length;

  const candidates = [
    ...FALLBACK_SKRIBBL_WORDS.slice(index),
    ...FALLBACK_SKRIBBL_WORDS.slice(0, index),
  ];

  const recentSet = new Set(
    recentWords.map((word) =>
      word.toLowerCase(),
    ),
  );

  for (const words of candidates) {
    const filtered = words.filter(
      (word) =>
        !recentSet.has(
          word.toLowerCase(),
        ),
    );

    if (filtered.length >= 3) {
      return filtered.slice(0, 3);
    }
  }

  return candidates[0];
}

/**
 * Generates an AI emoji trivia puzzle.
 */
export async function generateEmojiPuzzleAI(): Promise<EmojiPuzzle> {
  const prompt = `
Generate 1 fun emoji trivia puzzle.

The answer can represent:
- a famous movie
- song
- celebrity
- pop culture item
- video game

Return ONLY valid JSON using this format:

{
  "question": "🦁 👑",
  "options": [
    "Movie A",
    "Movie B",
    "The Lion King",
    "Movie D"
  ],
  "answer": 2
}

Rules:
- Exactly 4 options.
- Only one correct answer.
- "answer" must be the zero-based index of the correct option.
`;

  const responseText =
    await callOpenRouter(prompt);

  if (responseText) {
    try {
      const parsed = JSON.parse(responseText);

      if (
        parsed.question &&
        Array.isArray(parsed.options) &&
        parsed.options.length >= 4 &&
        typeof parsed.answer === "number"
      ) {
        return {
          question: String(
            parsed.question,
          ),
          options: parsed.options
            .slice(0, 4)
            .map((option: unknown) =>
              String(option),
            ),
          answer:
            Number(parsed.answer) % 4,
        };
      }
    } catch (error) {
      console.error(
        "Failed to parse AI emoji puzzle:",
        error,
      );
    }
  }

  return FALLBACK_EMOJI[
    Math.floor(
      Math.random() *
        FALLBACK_EMOJI.length,
    )
  ];
}
