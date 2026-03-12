// Pure road strip — callers control the outer container/positioning.
// Dashes: w-10 (40px) + mx-4 (16px gap) = 56px each.
// 60 dashes = 3360px; animation moves 1120px (20 units), leaving 2240px buffer.
export function DrivingAnimation() {
  return (
    <div className="relative h-24 w-full overflow-hidden bg-gray-800 dark:bg-gray-900">
      {/* Scrolling centre-line dashes */}
      <div className="absolute inset-y-0 flex items-center animate-road-scroll" style={{ width: "max-content" }}>
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-10 h-2 bg-yellow-400 rounded-full mx-4" />
        ))}
      </div>

      {/* Speed lines */}
      <div className="absolute inset-y-0 flex flex-col justify-center gap-2" style={{ left: "calc(50% - 72px)" }}>
        {[20, 13, 17].map((w, i) => (
          <div
            key={i}
            className="h-px bg-white/60 rounded animate-speed-line"
            style={{ width: `${w}px`, animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>

      {/* Car */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-4xl animate-car-bob inline-block select-none">🚗</span>
      </div>
    </div>
  );
}
