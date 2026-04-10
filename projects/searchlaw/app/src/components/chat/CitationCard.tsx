interface CitationCardProps {
  index: number
  title: string
  description: string
  status: 'active' | 'check'
  sections: string[]
  color: 'green' | 'purple' | 'blue'
  onClick?: () => void
  onSectionClick?: (section: string) => void
}

const colorMap = {
  green: {
    badge: 'bg-brand-600 text-white',
    border: 'hover:border-brand-400',
    section: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100',
    link: 'text-brand-600 hover:text-brand-700',
  },
  purple: {
    badge: 'bg-purple-600 text-white',
    border: 'hover:border-purple-400',
    section: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200 hover:bg-purple-100',
    link: 'text-purple-600 hover:text-purple-700',
  },
  blue: {
    badge: 'bg-blue-600 text-white',
    border: 'hover:border-blue-400',
    section: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100',
    link: 'text-blue-600 hover:text-blue-700',
  },
}

export default function CitationCard({
  index,
  title,
  description,
  status,
  sections,
  color,
  onClick,
  onSectionClick,
}: CitationCardProps) {
  const colors = colorMap[color] ?? colorMap.green

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors cursor-pointer ${colors.border}`}
    >
      {/* Header */}
      <div className="mb-2 flex items-start gap-3">
        <span
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${colors.badge}`}
        >
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-heading text-sm font-semibold text-gray-900 leading-snug">{title}</h4>
            <span
              className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                status === 'active'
                  ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
                  : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
              }`}
            >
              {status === 'active' ? (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  บังคับใช้
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  ตรวจสอบ
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="mt-1.5 mb-3 text-xs text-gray-500 leading-relaxed">{description}</p>

      {/* Section pills — clickable → open viewer at that section */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {sections.map((section) => (
          <button
            key={section}
            onClick={(e) => { e.stopPropagation(); onSectionClick?.(section); }}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${colors.section}`}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            {section}
          </button>
        ))}
      </div>

    </div>
  )
}
