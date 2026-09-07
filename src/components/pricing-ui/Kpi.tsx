export function Kpi({ label, value, small }: { label: string; value: string; small?: string }) {
  return (
    <div className="rb-kpi">
      <div className="l">{label}</div>
      <div className="v num">
        {value} {small && <small>{small}</small>}
      </div>
    </div>
  )
}
