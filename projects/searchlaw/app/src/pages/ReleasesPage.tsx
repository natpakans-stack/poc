import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import BookIcon from '../components/ui/BookIcon'
import { getReleases } from '../lib/api'

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

export default function ReleasesPage() {
  const [releases, setReleases] = useState<Release[]>([])

  useEffect(() => {
    getReleases().then(setReleases).catch(() => {})
  }, [])

  return (
    <div className="min-h-dvh">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition">
              <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              <span className="text-sm">กลับหน้าหลัก</span>
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600">
                <BookIcon className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-heading text-sm font-semibold text-gray-900">Legal AI</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 pt-12 pb-24">
        <div className="mb-12">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-gray-900">Release Notes</h1>
          <p className="mt-2 text-sm text-gray-500">ประวัติการอัพเดทข้อมูลกฎหมายและฟีเจอร์ทั้งหมด</p>
        </div>

        <div className="space-y-10">
          {releases.map((release) => (
            <article
              key={release.id}
              className="rounded-2xl bg-white p-6 ring-1 ring-gray-200 shadow-sm transition-[border-color] duration-200 hover:ring-brand-300"
            >
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span className="rounded-lg bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700 ring-1 ring-brand-200">
                  {release.version}
                </span>
                <time className="text-sm text-gray-400">{release.date}</time>
                {release.is_latest && (
                  <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700">Latest</span>
                )}
              </div>

              <ul className="space-y-3">
                {release.items.map((item: { tag: string; text: string }, i: number) => (
                  <li key={i} className="flex items-start gap-3">
                    <TagBadge tag={item.tag} />
                    <span className="text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: item.text }} />
                  </li>
                ))}
              </ul>

              {release.stats && (
                <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
                  <span>{release.stats}</span>
                </div>
              )}
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}
