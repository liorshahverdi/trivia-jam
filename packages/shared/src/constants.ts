import type { Category, Difficulty, DifficultySetting } from './types.js';

export const ROOM_CODE_LENGTH = 4;
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 20;
export const MAX_NAME_LENGTH = 20;
export const QUESTIONS_PER_GAME = 10;

export const QUESTION_TIME_SECONDS = 20;
export const COUNTDOWN_SECONDS = 3;
export const REVEAL_TIME_SECONDS = 5;
export const LEADERBOARD_TIME_SECONDS = 8;
export const RECONNECT_GRACE_SECONDS = 60;
export const HOST_RECONNECT_GRACE_SECONDS = 60;

export const POINTS_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 100,
  medium: 200,
  hard: 300,
};

export const MAX_TIME_BONUS = 50;
export const STREAK_BONUS = 25;
export const STREAK_THRESHOLD = 2;
export const MAX_STREAK_BONUS = 100;

export const AVATARS = ['🦊', '🐸', '🦉', '🐙', '🦄', '🐼', '🦁', '🐨', '🦋', '🐯', '🦖', '🐳', '🦜', '🐺', '🦝', '🐹', '🦈', '🐔', '🦀', '🐝'];

export const CATEGORY_LABELS: Record<Category, string> = {
  math: 'Math',
  science: 'Science',
  history: 'History',
  'current-events': 'Current Events',
  music: 'Music',
  food: 'Food & Drink',
  tech: 'Technology',
  geography: 'Geography',
  art: 'Art',
  entertainment: 'Entertainment',
  animals: 'Animals',
  general: 'General Knowledge',
  musicals: 'Musicals & Theatre',
  television: 'Television',
  'video-games': 'Video Games',
  'board-games': 'Board Games',
  mythology: 'Mythology',
  gadgets: 'Gadgets',
  anime: 'Anime & Manga',
  cartoons: 'Cartoons',
};

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, value);
}

export const DIFFICULTY_SETTINGS: DifficultySetting[] = ['mixed', 'easy', 'medium', 'hard'];

export function isDifficultySetting(value: unknown): value is DifficultySetting {
  return typeof value === 'string' && (DIFFICULTY_SETTINGS as string[]).includes(value);
}
