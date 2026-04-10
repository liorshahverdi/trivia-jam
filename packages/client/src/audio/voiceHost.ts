/**
 * VoiceHost — Web Speech API wrapper for a synthetic game show host.
 * Speaks at key moments with enthusiastic phrasing.
 */

type VoiceLinePool = readonly string[];

const VOICE_LINES = {
  playerJoin: (name: string): string[] => [
    `Welcome, ${name}!`,
    `${name} has entered the arena!`,
    `${name} is here! Let's go!`,
    `Look who it is! ${name}!`,
  ],
  gameStart: [
    "Let's get this party started!",
    "It's trivia time!",
    "Show me what you've got!",
    "Time to test your knowledge!",
  ] as const,
  allVoted: [
    "All answers are in!",
    "Everybody's locked in!",
    "That's everyone!",
  ] as const,
  revealCorrect: [
    "That's right!",
    "Nailed it!",
    "Correct!",
    "Well done!",
  ] as const,
  revealWrong: [
    "Ohhh, so close!",
    "Not quite!",
    "Better luck next time!",
    "Tough break!",
  ] as const,
  leaderboard: [
    "Let's see the scores!",
    "Here's where we stand!",
    "It's anyone's game!",
  ] as const,
  gameOverWin: [
    "What a performance!",
    "Champions!",
    "Absolutely incredible!",
    "You crushed it!",
  ] as const,
  gameOverLose: [
    "Better luck next time!",
    "That was a tough one!",
    "So close, yet so far!",
    "Don't give up!",
  ] as const,
} as const;

function pickRandom(pool: VoiceLinePool): string {
  return pool[Math.floor(Math.random() * pool.length)];
}

export class VoiceHost {
  private voice: SpeechSynthesisVoice | null = null;
  private ready = false;

  constructor() {
    this.selectVoice();
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.onvoiceschanged = () => this.selectVoice();
    }
  }

  private selectVoice(): void {
    if (typeof speechSynthesis === 'undefined') return;

    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) return;

    this.voice =
      voices.find((v) => v.name.includes('Daniel') && v.lang.startsWith('en')) ??
      voices.find((v) => v.lang.startsWith('en-') && v.name.includes('Male')) ??
      voices.find((v) => v.lang.startsWith('en')) ??
      voices[0];

    this.ready = true;
  }

  cancel(): void {
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel();
    }
  }

  say(text: string, options?: { rate?: number; pitch?: number; volume?: number }): void {
    if (typeof speechSynthesis === 'undefined' || !this.ready) return;

    this.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) utterance.voice = this.voice;
    utterance.rate = options?.rate ?? 1.05;
    utterance.pitch = options?.pitch ?? 1.1;
    utterance.volume = options?.volume ?? 1;
    speechSynthesis.speak(utterance);
  }

  announce(pool: VoiceLinePool): void {
    this.say(pickRandom(pool));
  }

  playerJoin(name: string): void {
    const lines = VOICE_LINES.playerJoin(name);
    this.say(lines[Math.floor(Math.random() * lines.length)]);
  }

  gameStart(): void {
    this.announce(VOICE_LINES.gameStart);
  }

  readQuestion(text: string, options?: string[]): void {
    let full = text;
    if (options && options.length > 0) {
      const labels = ['A', 'B', 'C', 'D'];
      const last = options.length - 1;
      const choiceText = options
        .map((opt, i) => i === last ? `Or is it ${labels[i]}? ${opt}.` : `Is it ${labels[i]}? ${opt}.`)
        .join(' ');
      full += ' ... ' + choiceText;
    }
    this.say(full, { rate: 0.95, pitch: 1.0 });
  }

  allVoted(): void {
    this.announce(VOICE_LINES.allVoted);
  }

  revealCorrect(): void {
    this.announce(VOICE_LINES.revealCorrect);
  }

  revealWrong(): void {
    this.announce(VOICE_LINES.revealWrong);
  }

  leaderboardComment(leaderName?: string): void {
    if (leaderName) {
      this.say(`${leaderName} is in the lead!`);
    } else {
      this.announce(VOICE_LINES.leaderboard);
    }
  }

  gameOverWin(): void {
    this.announce(VOICE_LINES.gameOverWin);
  }

  gameOverLose(): void {
    this.announce(VOICE_LINES.gameOverLose);
  }
}
