import he from 'he';
const { decode } = he;
import type { Category, Difficulty, Question } from '@trivia-jam/shared';

const CATEGORY_MAP: Record<string, number[]> = {
  math: [19],
  science: [17, 18],
  history: [23],
  music: [12],
  food: [0], // general knowledge, will filter
  'current-events': [], // not available on OpenTDB
};

const DIFFICULTY_MAP: Record<string, Difficulty> = {
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
};

interface OpenTDBResponse {
  response_code: number;
  results: OpenTDBQuestion[];
}

interface OpenTDBQuestion {
  category: string;
  type: string;
  difficulty: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function fetchFromOpenTDB(
  category: Category,
  count: number
): Promise<Question[]> {
  const catIds = CATEGORY_MAP[category];
  if (!catIds || catIds.length === 0) return [];

  const questions: Question[] = [];

  for (const catId of catIds) {
    const remaining = count - questions.length;
    if (remaining <= 0) break;

    // OpenTDB allows max 50 per request
    const amount = Math.min(remaining, 50);
    const url = catId === 0
      ? `https://opentdb.com/api.php?amount=${amount}&type=multiple`
      : `https://opentdb.com/api.php?amount=${amount}&category=${catId}&type=multiple`;

    try {
      const res = await fetch(url);
      const data: OpenTDBResponse = await res.json();

      if (data.response_code !== 0) {
        console.warn(`OpenTDB returned code ${data.response_code} for category ${catId}`);
        continue;
      }

      for (const q of data.results) {
        // For "food" category from general knowledge, filter
        if (category === 'food' && catId === 0) {
          const text = (q.question + q.correct_answer).toLowerCase();
          const foodKeywords = ['food', 'cook', 'dish', 'cuisine', 'recipe', 'ingredient', 'drink', 'beverage', 'fruit', 'vegetable', 'meat', 'bread', 'cheese', 'wine', 'beer', 'chocolate', 'spice', 'restaurant', 'chef', 'meal', 'dessert', 'pizza', 'sushi', 'coffee', 'tea', 'sugar', 'salt', 'pepper'];
          if (!foodKeywords.some(kw => text.includes(kw))) continue;
        }

        const allOptions = shuffleArray([
          decode(q.correct_answer),
          ...q.incorrect_answers.map(a => decode(a)),
        ]);
        const correctIndex = allOptions.indexOf(decode(q.correct_answer));

        questions.push({
          id: `${category}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          category,
          difficulty: DIFFICULTY_MAP[q.difficulty] || 'medium',
          question: decode(q.question),
          options: allOptions as [string, string, string, string],
          correctIndex,
        });
      }

      // Rate limit: OpenTDB asks for 5s between requests
      if (catIds.length > 1) {
        await new Promise(r => setTimeout(r, 5500));
      }
    } catch (err) {
      console.error(`Failed to fetch from OpenTDB category ${catId}:`, err);
    }
  }

  return questions;
}
