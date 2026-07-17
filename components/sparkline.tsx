export function Sparkline({ values, positive = true }: { values: number[]; positive?: boolean }) {
  const width = 130;
  const height = 44;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / Math.max(1, max - min)) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(" ");
  const color = positive ? "#ff665f" : "#29c99d";
  const fillId = `spark-${values.join("-")}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sparkline" role="img" aria-label="指数走势示意">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M${points} L${width},${height} L0,${height} Z`} fill={`url(#${fillId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
