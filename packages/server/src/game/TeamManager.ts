import type { Room, TeamColor, LeaderboardEntry, TeamLeaderboard } from '@trivia-jam/shared';

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
