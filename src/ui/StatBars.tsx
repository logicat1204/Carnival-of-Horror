import type { CoreStats } from '../shared/stats'

interface StatBarsProps {
  stats: CoreStats
  compact?: boolean
}

const ROWS: Array<{ key: keyof CoreStats; label: string; short: string }> = [
  { key: 'speed', label: 'Velocidad', short: 'VEL' },
  { key: 'physique', label: 'Físico', short: 'FÍS' },
  { key: 'dexterity', label: 'Destreza', short: 'DES' },
]

export function StatBars({ stats, compact = false }: StatBarsProps) {
  return (
    <div className={`stat-bars ${compact ? 'stat-bars--compact' : ''}`}>
      {ROWS.map((row) => (
        <div className="stat-row" key={row.key} title={`${row.label}: ${stats[row.key]}/100`}>
          <span className="stat-row__label">{compact ? row.short : row.label}</span>
          <span className="stat-row__track">
            <span className="stat-row__fill" style={{ width: `${stats[row.key]}%` }} />
          </span>
          <span className="stat-row__value">{stats[row.key]}</span>
        </div>
      ))}
    </div>
  )
}
