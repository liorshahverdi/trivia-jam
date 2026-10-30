import he from 'he';
const { decode } = he;
import type { Category, Difficulty, Question } from '@trivia-jam/shared';

/** OpenTDB category ids per Trivia Jam category (see https://opentdb.com/api_category.php). */
export const CATEGORY_MAP: Partial<Record<Category, number[]>> = {
  math: [19],
  science: [17],
  tech: [18],
  history: [23],
  music: [12],
  food: [0], // general knowledge, will filter
  geography: [22],
  art: [25],
  entertainment: [11, 26], // film, celebrities
  animals: [27],
  general: [9],
  musicals: [13],
  television: [14],
  'video-games': [15],
  'board-games': [16],
  mythology: [20],
  gadgets: [30],
  anime: [31],
  cartoons: [32],
  // 'current-events' is generated from news feeds, not OpenTDB.
};

/** OpenTDB rejects requests for more questions than it has, so step down. */
const AMOUNT_STEPS = [50, 25, 10, 5];
const RATE_LIMIT_MS = 5500;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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
  count: number,
  difficulty?: Difficulty,
): Promise<Question[]> {
  const catIds = CATEGORY_MAP[category];
  if (!catIds || catIds.length === 0) return [];

  const questions: Question[] = [];

  for (const catId of catIds) {
    const remaining = count - questions.length;
    if (remaining <= 0) break;

    for (const step of AMOUNT_STEPS) {
      const amount = Math.min(remaining, step);
      const params = new URLSearchParams({ amount: String(amount), type: 'multiple' });
      if (catId !== 0) params.set('category', String(catId));
      if (difficulty) params.set('difficulty', difficulty);

      let data: OpenTDBResponse;
      try {
        const res = await fetch(`https://opentdb.com/api.php?${params}`);
        data = await res.json();
      } catch (err) {
        console.error(`Failed to fetch from OpenTDB category ${catId}:`, err);
        break;
      } finally {
        await sleep(RATE_LIMIT_MS); // OpenTDB allows one request per 5 seconds
      }

      if (data.response_code === 1 && amount > AMOUNT_STEPS[AMOUNT_STEPS.length - 1]) continue; // not enough; ask for fewer
      if (data.response_code !== 0) {
        console.warn(`OpenTDB returned code ${data.response_code} for category ${catId} (${difficulty ?? 'any'})`);
        break;
      }

      for (const q of data.results) {
        // For "food" category from general knowledge, filter
        if (category === 'food' && catId === 0) {
          const text = (q.question + q.correct_answer).toLowerCase();
          const foodKeywords = ['food', 'cook', 'dish', 'cuisine', 'recipe', 'ingredient', 'drink', 'beverage', 'fruit', 'vegetable', 'meat', 'bread', 'cheese', 'wine', 'beer', 'chocolate', 'spice', 'restaurant', 'chef', 'meal', 'dessert', 'pizza', 'sushi', 'coffee', 'tea', 'sugar', 'salt', 'pepper'];
          if (!foodKeywords.some(kw => text.includes(kw))) continue;
        }

        const correct = decode(q.correct_answer);
        const allOptions = shuffleArray([correct, ...q.incorrect_answers.map(a => decode(a))]);

        questions.push({
          id: `${category}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          category,
          difficulty: DIFFICULTY_MAP[q.difficulty] || 'medium',
          question: decode(q.question),
          options: allOptions as [string, string, string, string],
          correctIndex: allOptions.indexOf(correct),
        });
      }
      break;
    }
  }

  return questions;
}
