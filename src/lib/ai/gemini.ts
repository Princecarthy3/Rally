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

async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch (err) {
      console.error(`Gemini API Error (${model}):`, err);
    }
  }

  return null;
}


export async function generateSkribblWordsAI(seed?: string, excludedWords: string[] = []): Promise<string[]> {
  const excluded = excludedWords.slice(-30).join(", ") || "none";
  const prompt = `Generate exactly 3 fun, creative, distinct single-word or short two-word nouns suitable for a drawing game like Skribbl. This is a fresh game prompt with nonce ${seed || crypto.randomUUID()}. Do not use any of these recently used words: ${excluded}. Return only a JSON array: ["Word1", "Word2", "Word3"]`;
  const responseText = await callGemini(prompt);
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
  const prompt = `Generate 1 interesting, family-friendly trivia question with exactly 4 distinct answer options. Use a different topic or angle for nonce ${seed || crypto.randomUUID()}. Return only JSON in this format: {"question":"Question text?","options":["Option 0","Option 1","Option 2","Option 3"],"answer":1}. The answer must be the zero-based index of the correct option.`;
  const responseText = await callGemini(prompt);
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

export async function generateEmojiPuzzleAI(): Promise<EmojiPuzzle> {
  const prompt = `Generate 1 fun emoji trivia puzzle representing a famous movie, song, celebrity, pop culture item, or video game. Provide emojis as 'question', 4 multiple choice options, and the correct 0-indexed answer. Return JSON object format: {"question": "🦁 👑", "options": ["Movie A", "Movie B", "The Lion King", "Movie D"], "answer": 2}`;
  const responseText = await callGemini(prompt);
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
