import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getReleases } from '../../lib/api'

interface Release {
  id: string
  version: string
  date: string
  is_latest: boolean
  items: { tag: string; text: string }[]
  stats: string | null
}

function TagBadge({ tag }: { tag: string }) {
  const cls = tag === 'Added' ? 'tag-added' : tag === 'Improved' ? 'tag-improved' : 'tag-fixed'
  return (
    <span className={`${cls} mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wider`}>
      {tag}
    </span>
  )
}

export default function ReleaseNotesSection() {
  const [releases, setReleases] = useState<Release[]>([])

  useEffect(() => {
    getReleases().then(setReleases).catch(() => {})
  }, [])

  const latest = releases.find((r) => r.is_latest) ?? releases[0]
  const previous = releases.filter((r) => r !== latest)

  if (!latest) return null

  return (
    <section id="releases" className="pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h2 className="font-heading text-xl font-semibold text-gray-900">อัพเดทล่าสุด</h2>
          <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700">{latest.version}</span>
        </div>
        <span className="text-sm text-gray-400">{latest.date}</span>
      </div>

      {/* Latest release */}
      <div className="release-card rounded-2xl bg-white p-6 ring-1 ring-gray-200 shadow-sm mb-6">
        <ul className="space-y-3">
          {latest.items.map((item: { tag: string; text: string }, i: number) => (
            <li key={i} className="flex items-start gap-3">
              <TagBadge tag={item.tag} />
              <span className="text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: item.text }} />
            </li>
          ))}
        </ul>
        {latest.stats && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
            {latest.stats}
          </div>
        )}
      </div>

      {/* Previous versions */}
      {previous.length > 0 && (
        <div className="rounded-2xl bg-gray-50 ring-1 ring-gray-200 divide-y divide-gray-200 overflow-hidden">
          {previous.map((ver) => (
            <div key={ver.version} className="px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500 ring-1 ring-gray-200">{ver.version}</span>
                <span className="text-sm text-gray-600">{ver.items[0]?.text?.replace(/<[^>]*>/g, '') ?? ''}</span>
              </div>
              <span className="text-xs text-gray-400 shrink-0 ml-4">{ver.date}</span>
            </div>
          ))}
        </div>
      )}

      {/* View all */}
      <div className="mt-4 text-center">
        <Link
          to="/releases"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 transition"
        >
          ดู Release Notes ทั้งหมด
          <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    </section>
  )
}
