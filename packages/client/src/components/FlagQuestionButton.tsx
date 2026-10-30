import { useState } from 'react';

interface Props {
  questionId: string;
  onFlag: (questionId: string, reason?: string) => void;
}

/** Lets players report a wrong or confusing question; reports feed the question blocklist. */
export default function FlagQuestionButton({ questionId, onFlag }: Props) {
  const [reportedId, setReportedId] = useState<string | null>(null);

  if (reportedId === questionId) {
    return <p className="text-white/50 text-xs">Thanks — question reported.</p>;
  }

  return (
    <button
      type="button"
      onClick={() => {
        onFlag(questionId);
        setReportedId(questionId);
      }}
      className="text-white/40 hover:text-white/80 text-xs underline underline-offset-2 cursor-pointer"
    >
      🚩 Report a problem with this question
    </button>
  );
}
