import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { SoundManager } from '../audio/sounds';
import { VoiceHost } from '../audio/voiceHost';
import type { RevealData, GameOverData } from '@trivia-jam/shared';

/**
 * Hook that subscribes to Zustand store and triggers SFX + voice
 * at the right moments on the host screen.
 *
 * Returns an `unlock` function that must be called from a user gesture.
 */
export function useSoundEffects(): { unlock: () => void } {
  const sounds = useRef<SoundManager | null>(null);
  const voice = useRef<VoiceHost | null>(null);

  if (!sounds.current) sounds.current = new SoundManager();
  if (!voice.current) voice.current = new VoiceHost();

  const prevPlayersLen = useRef(0);
  const prevCountdown = useRef(0);
  const prevPhase = useRef('lobby');
  const prevVoteTotal = useRef(0);
  const prevQuestionId = useRef<string | null>(null);
  const prevRevealData = useRef<RevealData | null>(null);
  const prevLeaderboard = useRef<unknown[]>([]);
  const prevGameOverData = useRef<GameOverData | null>(null);

  const unlock = useCallback(() => {
    sounds.current!.unlock();
    // Silent utterance to warm up speechSynthesis
    voice.current!.say('', { volume: 0 });
  }, []);

  useEffect(() => {
    prevPlayersLen.current = useGameStore.getState().players.length;
    prevPhase.current = useGameStore.getState().phase;

    return useGameStore.subscribe((state) => {
      const s = sounds.current!;
      const v = voice.current!;

      // --- Player joins ---
      const len = state.players.length;
      if (len > prevPlayersLen.current) {
        s.playerJoin();
        const newPlayer = state.players[len - 1];
        if (newPlayer) {
          setTimeout(() => v.playerJoin(newPlayer.name), 300);
        }
      }
      prevPlayersLen.current = len;

      // --- Countdown ticks ---
      const cd = state.countdownValue;
      if (cd !== prevCountdown.current && cd >= 1 && cd <= 3) {
        s.countdownTick();
      }
      prevCountdown.current = cd;

      // --- Phase changes (only for SFX that don't depend on data) ---
      const phase = state.phase;
      if (phase !== prevPhase.current) {
        const prev = prevPhase.current;
        prevPhase.current = phase;

        if (phase === 'question' && prev === 'countdown') {
          s.countdownGo();
        }
        if (phase === 'question' && prev === 'category_select') {
          v.gameStart();
        }
      }

      // --- New question arrived → read it aloud ---
      const qId = state.currentQuestion?.id ?? null;
      if (qId && qId !== prevQuestionId.current) {
        prevQuestionId.current = qId;
        const q = state.currentQuestion!;
        setTimeout(() => v.readQuestion(q.question, [...q.options]), 400);
      }

      // --- Reveal data arrived → correct/wrong SFX + voice ---
      if (state.revealData && state.revealData !== prevRevealData.current) {
        prevRevealData.current = state.revealData;
        const rd = state.revealData;
        const correct = rd.coopResult
          ? rd.coopResult.correct
          : rd.playerResults.some((p) => p.correct);
        if (correct) {
          s.revealCorrect();
          setTimeout(() => v.revealCorrect(), 300);
        } else {
          s.revealWrong();
          setTimeout(() => v.revealWrong(), 300);
        }
      }

      // --- Leaderboard data arrived → drum roll + leader comment ---
      if (state.leaderboard.length > 0 && state.leaderboard !== prevLeaderboard.current) {
        prevLeaderboard.current = state.leaderboard;
        if (state.phase === 'leaderboard') {
          s.leaderboard();
          if (state.mode === 'coop') {
            const score = state.coopScore;
            if (score > 0) {
              setTimeout(() => v.say(`Co-op score: ${score} points!`), 400);
            } else {
              setTimeout(() => v.announce(['Keep trying!', "You'll get the next one!", "Let's turn this around!"]), 400);
            }
          } else {
            const leader = state.leaderboard[0];
            if (leader) {
              setTimeout(() => v.leaderboardComment(leader.name), 400);
            }
          }
        }
      }

      // --- Game over data arrived ---
      if (state.gameOverData && state.gameOverData !== prevGameOverData.current) {
        prevGameOverData.current = state.gameOverData;
        if (state.gameOverData.coopWin) {
          s.gameOverWin();
          setTimeout(() => v.gameOverWin(), 500);
        } else {
          s.gameOverLose();
          setTimeout(() => v.gameOverLose(), 500);
        }
      }

      // --- Vote received (coop mode) ---
      const voteTotal = state.voteCounts.reduce((a, b) => a + b, 0);
      if (voteTotal > prevVoteTotal.current) {
        s.voteReceived();
      }
      prevVoteTotal.current = voteTotal;
    });
  }, []);

  return { unlock };
}
