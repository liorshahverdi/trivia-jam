interface RoomCodeDisplayProps {
  code: string;
  large?: boolean;
}

export default function RoomCodeDisplay({ code, large }: RoomCodeDisplayProps) {
  return (
    <div className="text-center">
      {large && <p className="text-white/60 text-sm mb-2 uppercase tracking-wider">Room Code</p>}
      <div className={`font-mono font-black tracking-[0.3em] ${large ? 'text-6xl' : 'text-3xl'} bg-gradient-to-r from-jam-purple to-jam-pink bg-clip-text text-transparent`}>
        {code}
      </div>
    </div>
  );
}
