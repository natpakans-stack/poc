const stats = [
  { value: '245', label: 'ฉบับกฎหมาย', trend: '+12 ฉบับใหม่', hasTrend: true },
  { value: '12,400', label: 'มาตรา', trend: '+840 มาตรา', hasTrend: true },
  { value: '3,200', label: 'คำพิพากษาศาลฎีกา', trend: '+1,200 คำพิพากษา', hasTrend: true },
  { value: '5', label: 'แหล่งข้อมูล', trend: 'ทั้งหมดพร้อมใช้', hasTrend: false },
]

export default function StatsSection() {
  return (
    <section className="pb-20">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="stat-card rounded-2xl bg-white p-6 ring-1 ring-gray-200 shadow-sm"
          >
            <p className="font-heading text-3xl font-bold text-gray-900">{stat.value}</p>
            <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
            <div className={`mt-3 flex items-center gap-1 text-xs ${stat.hasTrend ? 'text-brand-600' : 'text-gray-500'}`}>
              {stat.hasTrend ? (
                <svg className="h-3 w-3" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              )}
              {stat.trend}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
