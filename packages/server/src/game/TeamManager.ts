import type { Room, TeamColor, LeaderboardEntry, TeamLeaderboard, Player } from '@trivia-jam/shared';
import { shuffle, type Random } from './QuestionPicker.js';

export function getTeamLeaderboard(room: Room): TeamLeaderboard {
  return { ...room.teamScores };
}

export function getPlayerLeaderboard(room: Room): LeaderboardEntry[] {
  return room.players
    .filter(p => p.connected)
    .map(p => ({
      playerId: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      streak: p.streak,
      team: p.team,
    }))
    .sort((a, b) => b.score - a.score);
}

export function addTeamScore(room: Room, team: TeamColor, points: number): void {
  room.teamScores[team] += points;
}

/** Split connected players evenly; disconnected players get a team if they return. */
export function assignTeams(room: Room, random: Random = Math.random): void {
  room.players.forEach(p => { p.team = undefined; });
  shuffle(room.players.filter(p => p.connected), random).forEach((p, i) => {
    p.team = i % 2 === 0 ? 'red' : 'blue';
  });
}

/** Put a player who (re)joins mid-game on the smaller team. */
export function assignLateTeam(room: Room, player: Player): void {
  if (room.mode !== 'teams' || room.phase === 'lobby' || player.team) return;
  const red = room.players.filter(p => p.team === 'red').length;
  const blue = room.players.filter(p => p.team === 'blue').length;
  player.team = red <= blue ? 'red' : 'blue';
}
