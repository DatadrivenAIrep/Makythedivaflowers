type Props = { points: number[]; ariaLabel: string };

const W = 240;
const H = 48;
const PAD = 4;

export default function Sparkline({ points, ariaLabel }: Props) {
  const max = points.length ? Math.max(...points) : 0;
  const min = points.length ? Math.min(...points) : 0;
  const span = max - min || 1;
  const stepX = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - ((p - min) / span) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const last = coords[coords.length - 1]?.split(",").map(Number);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={ariaLabel}
      className="h-12 w-full"
      preserveAspectRatio="none"
    >
      {coords.length > 0 && (
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-rouge"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {last && <circle cx={last[0]} cy={last[1]} r="2.5" className="fill-rouge" />}
    </svg>
  );
}
