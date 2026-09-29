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
  { answer: "Spider-Man", emojis: ["🕷️", "🧑", "🦸", "🏙️"], category: "People & Characters", acceptableAnswers: ["spiderman", "spider man", "spider-man"], difficulty: "medium", explanation: "A spider and a superhero in a city suggest the wall-crawling hero." },
  { answer: "Hot potato", emojis: ["🔥", "🥔", "⏱️"], category: "Phrases", acceptableAnswers: ["hot potato"], difficulty: "medium", explanation: "A potato is hot and needs to be passed quickly." },
  { answer: "Tennis", emojis: ["🎾", "🏆", "👟"], category: "Sports", acceptableAnswers: ["tennis"], difficulty: "easy", explanation: "A tennis ball and trophy point to the sport." },
  { answer: "Breakfast", emojis: ["🍳", "🥞", "☕"], category: "Food", acceptableAnswers: ["breakfast"], difficulty: "easy", explanation: "Classic morning foods make breakfast." },
  { answer: "Ice cream", emojis: ["🍦", "🍨", "❄️"], category: "Food", acceptableAnswers: ["ice cream", "icecream"], difficulty: "easy", explanation: "Cold sweet treats point to ice cream." },
  { answer: "Basketball", emojis: ["🏀", "🏟️", "👟"], category: "Sports", acceptableAnswers: ["basketball"], difficulty: "easy", explanation: "A hoop ball and court gear mean basketball." },
  { answer: "Snow White", emojis: ["❄️", "👸", "🍎"], category: "Movies", acceptableAnswers: ["snow white"], difficulty: "medium", explanation: "A princess, snow, and an apple hint at Snow White." },
  { answer: "Time flies", emojis: ["⏰", "✈️", "🕊️"], category: "Phrases", acceptableAnswers: ["time flies"], difficulty: "hard", explanation: "A clock and flying birds suggest the phrase time flies." },
  { answer: "Broken heart", emojis: ["💔", "😢", "🩹"], category: "Phrases", acceptableAnswers: ["broken heart", "heartbreak"], difficulty: "easy", explanation: "A cracked heart and sadness mean a broken heart." },
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
  if (answer.length < 2 || answer.length > 64 || emojis.length < 2 || emojis.length > 7 || emojis.some((emoji) => emoji.length > 32) || category.length < 2 || category.length > 40 || explanation.length < 4 || explanation.length > 220 || acceptableAnswers.length > 8 || UNSAFE_PUZZLE_TERMS.test(fullText)) return null;
  const emojiAnswer = answer.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (emojis.some((emoji) => emoji.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "") === emojiAnswer)) return null;
  return { answer, emojis, category, acceptableAnswers: [...new Set([answer, ...acceptableAnswers])], difficulty, explanation };
}

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    // strip markdown fences
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* continue */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

export async function generateEmojiDecodePuzzleAI(options: { difficulty?: EmojiDecodeDifficulty; category?: string; nonce?: string } = {}): Promise<{ puzzle: EmojiDecodePuzzle; source: "ai" | "fallback" }> {
  const difficulty = options.difficulty ?? "medium";
  const category = options.category ?? "Random";
  const nonce = options.nonce ?? crypto.randomUUID();
  const prompt = `Create one original Emoji Decode puzzle for a friendly multiplayer party game.
Category: ${category}
Difficulty: ${difficulty}
Rules:
- Use 2 to 6 common emoji that form a rebus or phrase.
- The answer must be a short movie, character, sport, food, or everyday phrase (2-40 characters).
- Family-friendly only. No politics, hate, sexual, or dangerous content.
- Include acceptableAnswers with 1-4 alternate spellings (lowercase ok).
Return ONLY a JSON object with these keys:
{"answer":"string","emojis":["emoji",...],"category":"string","acceptableAnswers":["string"],"difficulty":"${difficulty}","explanation":"one short sentence"}
Variety nonce: ${nonce}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const responseText = await callOpenRouter(
      `${prompt}\nAttempt ${attempt + 1}. JSON only.`,
      12000,
      350,
    );
    if (!responseText) continue;
    try {
      const parsed = extractJsonObject(responseText);
      const puzzle = validateEmojiDecodePuzzle(parsed, difficulty);
      if (puzzle) return { puzzle, source: "ai" };
      console.error("Emoji Decode puzzle failed validation:", responseText.slice(0, 400));
    } catch (error) {
      console.error("Failed to parse Emoji Decode puzzle:", error);
    }
  }

  // Deterministic-ish fallback pick so different rooms/rounds diverge a bit
  const idx = Math.abs(
    Array.from(nonce).reduce((acc, ch) => acc + ch.charCodeAt(0), 0),
  ) % SAFE_EMOJI_DECODE_FALLBACKS.length;
  const fallback = SAFE_EMOJI_DECODE_FALLBACKS[idx] ?? SAFE_EMOJI_DECODE_FALLBACKS[0];
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
  maxTokens = 300,
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY;

  if (!apiKey) {
    console.error("OPENROUTER_API_KEY is not configured.");
    return null;
  }

  const models = [
    process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite",
    "google/gemini-2.0-flash-001",
    "openai/gpt-4o-mini",
  ];

  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // First try with json_object; some models reject it — retry without.
      for (const useJsonFormat of [true, false]) {
        const body: Record<string, unknown> = {
          model,
          messages: [
            {
              role: "system",
              content: "You are a JSON API. Return only valid JSON. No markdown, no commentary.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.85,
        };
        if (useJsonFormat) {
          body.response_format = { type: "json_object" };
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://rallygames.vercel.app",
            "X-Title": "Rally",
          },
          signal: controller.signal,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          console.error(`OpenRouter API Error (${model}, json=${useJsonFormat}): ${response.status}`, errText.slice(0, 300));
          // If json_object unsupported, try without; otherwise next model
          if (useJsonFormat && (response.status === 400 || response.status === 404)) continue;
          break;
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        const text =
          typeof content === "string"
            ? content
            : Array.isArray(content)
              ? content.map((part: { text?: string } | string) => (typeof part === "string" ? part : part?.text || "")).join("")
              : null;

        if (text && String(text).trim()) {
          return String(text);
        }
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
