/**
 * In-memory player reports for bad questions. Reports are logged (searchable in
 * host logs) and exposed at GET /flags so they can be promoted into the committed
 * packages/shared/src/question-blocklist.json. Once enough distinct players flag a
 * question, this server process stops serving it until restart.
 */
export const FLAG_EXCLUDE_THRESHOLD = 2;
const MAX_REASON_LENGTH = 200;

interface FlagRecord {
  reporters: Set<string>;
  reasons: string[];
  firstFlaggedAt: string;
}

const flags = new Map<string, FlagRecord>();

export function flagQuestion(
  questionId: string,
  reporterId: string,
  reason?: string,
): { accepted: boolean; count: number } {
  let record = flags.get(questionId);
  if (!record) {
    record = { reporters: new Set(), reasons: [], firstFlaggedAt: new Date().toISOString() };
    flags.set(questionId, record);
  }
  if (record.reporters.has(reporterId)) return { accepted: false, count: record.reporters.size };

  record.reporters.add(reporterId);
  const trimmedReason = typeof reason === 'string' ? reason.trim().slice(0, MAX_REASON_LENGTH) : '';
  if (trimmedReason) record.reasons.push(trimmedReason);

  console.warn(`[question-flag] ${JSON.stringify({ questionId, count: record.reporters.size, reason: trimmedReason || undefined })}`);
  return { accepted: true, count: record.reporters.size };
}

export function isRuntimeExcluded(questionId: string): boolean {
  return (flags.get(questionId)?.reporters.size ?? 0) >= FLAG_EXCLUDE_THRESHOLD;
}

export function getFlagReport(): Array<{ questionId: string; count: number; reasons: string[]; firstFlaggedAt: string }> {
  return [...flags.entries()]
    .map(([questionId, record]) => ({
      questionId,
      count: record.reporters.size,
      reasons: record.reasons,
      firstFlaggedAt: record.firstFlaggedAt,
    }))
    .sort((a, b) => b.count - a.count);
}

export function clearFlags(): void {
  flags.clear();
}
