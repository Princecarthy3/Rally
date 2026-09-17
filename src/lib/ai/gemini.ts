export interface TriviaQuestion {
  question: string;
  options: string[];
  answer: number;
}

export interface EmojiPuzzle {
  question: string;
  options: string[];
  answer: number;
}

// A room can have several clients (and possibly a bot) request the next
// question at once. Share the OpenRouter request while it is in progress so
// only one candidate is generated for that round.
const pendingTriviaQuestions = new Map<string, Promise<TriviaQuestion>>();

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
  { question: "🦁 👑", options: ["Jungle Book", "Madagascar", "The Lion King", "Tarzan"], answer: 2 },
  { question: "🕷️ 👨", options: ["Spider-Man", "Ant-Man", "Batman", "Venom"], answer: 0 },
  { question: "👻 🚫", options: ["Casper", "Ghostbusters", "Poltergeist", "Beetlejuice"], answer: 1 },
  { question: "🚀 🌌 ⏳", options: ["Star Wars", "Interstellar", "Gravity", "Apollo 13"], answer: 1 },
  { question: "🦇 👨 🏙️", options: ["Daredevil", "Batman", "Iron Man", "Superman"], answer: 1 },
];

async function callOpenRouter(prompt: string, timeoutMs = 8000): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const models = [
    process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-lite-001",
    "openai/gpt-4o-mini",
  ];
  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
          "X-Title": "Rally",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Return only valid JSON. Do not use markdown fences." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 256,
          temperature: 0.7,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) return text;
      } else {
        console.error(`OpenRouter API Error (${model}): ${res.status} ${await res.text()}`);
      }
    } catch (err) {
      console.error(`OpenRouter API Error (${model}):`, err instanceof Error ? err.message : err);
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}


export async function generateSkribblWordsAI(seed?: string, excludedWords: string[] = []): Promise<string[]> {
  const excluded = excludedWords.slice(-30).join(", ") || "none";
  const prompt = `Generate exactly 3 fun, creative, distinct single-word or short two-word nouns suitable for a drawing game like Skribbl. This is a fresh game prompt with nonce ${seed || crypto.randomUUID()}. Do not use any of these recently used words: ${excluded}. Return only a JSON array: ["Word1", "Word2", "Word3"]`;
  const responseText = await callOpenRouter(prompt);
  if (responseText) {
    try {
      const parsed = JSON.parse(responseText);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.slice(0, 3).map((w: string) => String(w).trim());
      }
    } catch {}
  }

  // Include the game nonce in fallback selection too, so a missing AI key does
  // not make every room begin with the same three suggestions.
  const index = [...(seed || crypto.randomUUID())].reduce((total, char) => total + char.charCodeAt(0), 0) % FALLBACK_SKRIBBL_WORDS.length;
  const randomSet = FALLBACK_SKRIBBL_WORDS[index];
  return randomSet;
}

export async function generateTriviaQuestionAI(seed?: string): Promise<TriviaQuestion> {
  const prompt = `Generate one short, family-friendly trivia question for a fast multiplayer game. Use exactly 4 concise, distinct options and one unambiguous correct answer. Vary the topic for nonce ${seed || crypto.randomUUID()}. Return only JSON: {"question":"Question text?","options":["Option 0","Option 1","Option 2","Option 3"],"answer":1}. Answer is the zero-based correct-option index.`;
  const responseText = await callOpenRouter(prompt, 3500);
  if (responseText) {
    try {
      const parsed = JSON.parse(responseText);
      if (parsed.question && Array.isArray(parsed.options) && parsed.options.length === 4 && typeof parsed.answer === "number" && parsed.answer >= 0 && parsed.answer < 4) {
        return {
          question: String(parsed.question),
          options: parsed.options.map((o: unknown) => String(o)),
          answer: Number(parsed.answer),
        };
      }
    } catch {}
  }

  throw new Error("Trivia AI could not generate a valid question");
}

export function generateSharedTriviaQuestion(roomId: string, round: number): Promise<TriviaQuestion> {
  const key = `${roomId}:${round}`;
  const pending = pendingTriviaQuestions.get(key);
  if (pending) return pending;

  const request = generateTriviaQuestionAI(key).finally(() => pendingTriviaQuestions.delete(key));
  pendingTriviaQuestions.set(key, request);
  return request;
}

export async function generateEmojiPuzzleAI(): Promise<EmojiPuzzle> {
  const prompt = `Generate 1 fun emoji trivia puzzle representing a famous movie, song, celebrity, pop culture item, or video game. Provide emojis as 'question', 4 multiple choice options, and the correct 0-indexed answer. Return JSON object format: {"question": "🦁 👑", "options": ["Movie A", "Movie B", "The Lion King", "Movie D"], "answer": 2}`;
  const responseText = await callOpenRouter(prompt);
  if (responseText) {
    try {
      const parsed = JSON.parse(responseText);
      if (parsed.question && Array.isArray(parsed.options) && typeof parsed.answer === "number") {
        return {
          question: String(parsed.question),
          options: parsed.options.map((o: any) => String(o)),
          answer: Number(parsed.answer) % 4,
        };
      }
    } catch {}
  }

  return FALLBACK_EMOJI[Math.floor(Math.random() * FALLBACK_EMOJI.length)];
}
