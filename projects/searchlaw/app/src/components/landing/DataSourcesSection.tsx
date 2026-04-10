import { useState, useEffect } from 'react'
import { getDataSources } from '../../lib/api'

const iconPaths: Record<string, string> = {
  brand: 'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21',
  purple: 'M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z',
  blue: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  amber: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z',
  rose: 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342',
}

const iconStyles: Record<string, string> = {
  brand: 'bg-brand-50 ring-brand-200 text-brand-600',
  purple: 'bg-purple-50 ring-purple-200 text-purple-600',
  blue: 'bg-blue-50 ring-blue-200 text-blue-600',
  amber: 'bg-amber-50 ring-amber-200 text-amber-600',
  rose: 'bg-rose-50 ring-rose-200 text-rose-600',
}

interface DataSource {
  id: string
  name: string
  description: string | null
  url: string | null
  status: string
  badges: string[]
  icon_color: string | null
  sort_order: number
}

export default function DataSourcesSection() {
  const [sources, setSources] = useState<DataSource[]>([])

  useEffect(() => {
    getDataSources().then(setSources).catch(() => {})
  }, [])

  if (sources.length === 0) return null

  return (
    <section id="sources" className="pb-20">
      <div className="flex items-center gap-3 mb-8">
        <h2 className="font-heading text-xl font-semibold text-gray-900">แหล่งข้อมูลที่รวบรวม</h2>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600 ring-1 ring-brand-200">{sources.length} แหล่ง</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sources.map((source) => {
          const color = source.icon_color ?? 'brand'
          const Wrapper = source.url && source.status === 'active'
            ? (props: { children: React.ReactNode; className: string }) => (
                <a href={`https://${source.url}`} target="_blank" rel="noopener noreferrer" className={props.className}>{props.children}</a>
              )
            : (props: { children: React.ReactNode; className: string }) => (
                <div className={props.className}>{props.children}</div>
              )

          return (
            <Wrapper
              key={source.id}
              className={`group rounded-2xl bg-white p-6 ring-1 ring-gray-200 hover:ring-brand-300 transition-all shadow-sm ${source.url && source.status === 'active' ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${iconStyles[color] ?? iconStyles.brand}`}>
                  <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[color] ?? iconPaths.brand} />
                  </svg>
                </div>
                <span className={`flex items-center gap-1.5 text-xs ${source.status === 'active' ? 'text-brand-600' : 'text-amber-600'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${source.status === 'active' ? 'bg-brand-500' : 'bg-amber-500'}`} />
                  {source.status === 'active' ? 'Active' : 'Planned'}
                </span>
              </div>
              <h3 className="font-heading mt-4 text-sm font-semibold text-gray-900">{source.name}</h3>
              <p className="mt-1 text-xs text-gray-500">{source.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {source.badges.map((badge: string) => (
                  <span key={badge} className="source-badge rounded-md px-2 py-0.5 text-xs text-gray-600">
                    {badge}
                  </span>
                ))}
              </div>
            </Wrapper>
          )
        })}
      </div>
    </section>
  )
}
