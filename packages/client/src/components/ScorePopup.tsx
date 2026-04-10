interface ScorePopupProps {
  points: number;
  correct: boolean;
}

export default function ScorePopup({ points, correct }: ScorePopupProps) {
  if (!correct) {
    return (
      <div className="animate-bounce-in text-center">
        <div className="text-4xl mb-2">😢</div>
        <div className="text-jam-red font-bold text-xl">Wrong!</div>
      </div>
    );
  }

  return (
    <div className="animate-bounce-in text-center">
      <div className="text-4xl mb-2">🎉</div>
      <div className="text-jam-green font-bold text-xl">Correct!</div>
      {points > 0 && <div className="text-jam-yellow font-bold text-2xl mt-1">+{points}</div>}
    </div>
  );
}
