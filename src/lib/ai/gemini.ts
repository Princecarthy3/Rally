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

const FALLBACK_TRIVIA: TriviaQuestion[] = [
  { question: "Which planet has the shortest day in our solar system?", options: ["Mercury", "Jupiter", "Mars", "Neptune"], answer: 1 },
  { question: "What element has the chemical symbol 'Au'?", options: ["Silver", "Aluminum", "Gold", "Copper"], answer: 2 },
  { question: "How many hearts does an octopus have?", options: ["1", "2", "3", "4"], answer: 2 },
  { question: "Which country gifted the Statue of Liberty to the USA?", options: ["Great Britain", "France", "Germany", "Spain"], answer: 1 },
  { question: "What is the hardest natural substance on Earth?", options: ["Quartz", "Titanium", "Diamond", "Corundum"], answer: 2 },
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


export async function generateSkribblWordsAI(): Promise<string[]> {
  const prompt = `Generate 3 fun, creative, distinct single-word or short 2-word nouns suitable for a drawing game like Skribbl. Return JSON array format: ["Word1", "Word2", "Word3"]`;
  const responseText = await callGemini(prompt);
  if (responseText) {
    try {
      const parsed = JSON.parse(responseText);
      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.slice(0, 3).map((w: string) => String(w).trim());
      }
    } catch {}
  }

  const randomSet = FALLBACK_SKRIBBL_WORDS[Math.floor(Math.random() * FALLBACK_SKRIBBL_WORDS.length)];
  return randomSet;
}

export async function generateTriviaQuestionAI(): Promise<TriviaQuestion> {
  const prompt = `Generate 1 interesting fun trivia question with 4 options and the index (0, 1, 2, or 3) of the correct answer. Return JSON object format: {"question": "Question text?", "options": ["Opt0", "Opt1", "Opt2", "Opt3"], "answer": 1}`;
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

  return FALLBACK_TRIVIA[Math.floor(Math.random() * FALLBACK_TRIVIA.length)];
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
