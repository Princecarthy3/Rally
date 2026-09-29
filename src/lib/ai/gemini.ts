export interface EmojiPuzzle {
  question: string;
  options: string[];
  answer: number;
}

export type EmojiDecodeDifficulty = "easy" | "medium" | "hard";
export type EmojiDecodePuzzle = {
  answer: string;
  emojis: string[];
  category: string;
  acceptableAnswers: string[];
  difficulty: EmojiDecodeDifficulty;
  explanation: string;
};

const SAFE_EMOJI_DECODE_FALLBACKS: EmojiDecodePuzzle[] = [
  { answer: "The Lion King", emojis: ["🦁", "👑", "🌅"], category: "Movies", acceptableAnswers: ["lion king", "the lion king"], difficulty: "medium", explanation: "A lion and a crown point to the famous animated royal story." },
  { answer: "Spider-Man", emojis: ["🕷️", "🧑", "🦸", "🏙️"], category: "People & Characters", acceptableAnswers: ["spiderman", "spider man"], difficulty: "medium", explanation: "A spider and a superhero in a city suggest the wall-crawling hero." },
  { answer: "Hot potato", emojis: ["🔥", "🥔", "⏱️"], category: "Phrases", acceptableAnswers: ["hot potato"], difficulty: "medium", explanation: "A potato is hot and needs to be passed quickly." },
  { answer: "Tennis", emojis: ["🎾", "🏆", "👟"], category: "Sports", acceptableAnswers: ["tennis"], difficulty: "easy", explanation: "A tennis ball and trophy point to the sport." },
];

const UNSAFE_PUZZLE_TERMS = /\b(nazi|terrorist|porn|sex|rape|slur|kill yourself)\b/i;

function validateEmojiDecodePuzzle(value: unknown, difficulty: EmojiDecodeDifficulty): EmojiDecodePuzzle | null {
  if (!value || typeof value !== "object") return null;
  const puzzle = value as Record<string, unknown>;
  const answer = typeof puzzle.answer === "string" ? puzzle.answer.trim() : "";
  const emojis = Array.isArray(puzzle.emojis) ? puzzle.emojis.filter((item): item is string => typeof item === "string").map((item) => item.trim()) : [];
  const category = typeof puzzle.category === "string" ? puzzle.category.trim() : "";
  const explanation = typeof puzzle.explanation === "string" ? puzzle.explanation.trim() : "";
  const acceptableAnswers = Array.isArray(puzzle.acceptableAnswers) ? puzzle.acceptableAnswers.filter((item): item is string => typeof item === "string").map((item) => item.trim()) : [];
  const fullText = [answer, category, explanation, ...acceptableAnswers].join(" ");
  if (answer.length < 2 || answer.length > 64 || emojis.length < 2 || emojis.length > 7 || emojis.some((emoji) => emoji.length > 12) || category.length < 2 || category.length > 40 || explanation.length < 8 || explanation.length > 220 || acceptableAnswers.length > 8 || UNSAFE_PUZZLE_TERMS.test(fullText)) return null;
  const emojiAnswer = answer.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (emojis.some((emoji) => emoji.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "") === emojiAnswer)) return null;
  return { answer, emojis, category, acceptableAnswers: [...new Set([answer, ...acceptableAnswers])], difficulty, explanation };
}

export async function generateEmojiDecodePuzzleAI(options: { difficulty?: EmojiDecodeDifficulty; category?: string; nonce?: string } = {}): Promise<{ puzzle: EmojiDecodePuzzle; source: "ai" | "fallback" }> {
  const difficulty = options.difficulty ?? "medium";
  const category = options.category ?? "Random";
  const nonce = options.nonce ?? crypto.randomUUID();
  const prompt = `Create one original Emoji Decode puzzle for a friendly multiplayer party game.\nCategory: ${category}\nDifficulty: ${difficulty}\nRules: Use 2 to 7 emojis with a meaningful, guessable connection. Never include the answer literally as emoji text or make a trivial one-emoji rebus. Use recognizable family-friendly topics. Avoid politics, hateful, sexual, dangerous, or offensive content, and avoid quotes or copyrighted lyrics. Include a canonical answer, a short list of reasonable alternative spellings, category, difficulty, and one-sentence explanation. Return only JSON with exactly these fields: {"answer":"...","emojis":["..."],"category":"...","acceptableAnswers":["..."],"difficulty":"${difficulty}","explanation":"..."}. Variety nonce: ${nonce}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const responseText = await callOpenRouter(`${prompt}\nValidation attempt: ${attempt + 1}`, 2500);
    if (!responseText) continue;
    try {
      const puzzle = validateEmojiDecodePuzzle(JSON.parse(responseText), difficulty);
      if (puzzle) return { puzzle, source: "ai" };
    } catch (error) {
      console.error("Failed to parse Emoji Decode puzzle:", error);
    }
  }
  const fallback = SAFE_EMOJI_DECODE_FALLBACKS[Math.floor(Math.random() * SAFE_EMOJI_DECODE_FALLBACKS.length)];
  return { puzzle: { ...fallback, difficulty }, source: "fallback" };
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
