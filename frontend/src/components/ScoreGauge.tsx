'use client'

interface Props { score: number; size?: number }

export function ScoreGauge({ score, size = 80 }: Props) {
  const radius = (size - 12) / 2
  const circ = 2 * Math.PI * radius
  const pct = Math.min(score, 100) / 100
  const offset = circ * (1 - pct * 0.75)
  const color = score >= 80 ? '#f59e0b' : score >= 65 ? '#3b82f6' : '#6b7280'
  const label = score >= 80 ? 'LOTTERY' : score >= 65 ? 'WATCH' : 'LOW'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-[135deg]">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e2d42" strokeWidth={8} strokeDasharray={circ} strokeDashoffset={circ * 0.25} strokeLinecap="round" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }} />
        <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fill={color}
          fontSize={size * 0.22} fontWeight="700" style={{ transform: 'rotate(135deg)', transformOrigin: `${size / 2}px ${size / 2}px` }}>
          {score}
        </text>
      </svg>
      <span style={{ color, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{label}</span>
    </div>
  )
}
