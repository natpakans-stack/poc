import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import TypewriterText from '../ui/TypewriterText'
import { getSystemStats, getExampleQuestions } from '../../lib/api'

const fallbackQuestions = [
  'จะเปิดซาวน่าในโรงแรม ต้องขอใบอนุญาตอะไรบ้าง?',
  'ใบอนุญาตขายแอลกอฮอล์ในโรงแรม',
  'กฎหมายคุ้มครองผู้บริโภค e-commerce',
]

const fallbackStats = [
  { value: '245', label: 'ฉบับกฎหมาย', trend: '+12 ฉบับใหม่', has_trend: true },
  { value: '12,400', label: 'มาตรา', trend: '+840 มาตรา', has_trend: true },
  { value: '3,200', label: 'คำพิพากษาศาลฎีกา', trend: '+1,200 คำพิพากษา', has_trend: true },
  { value: '5', label: 'แหล่งข้อมูล', trend: 'ทั้งหมดพร้อมใช้', has_trend: false },
]

export default function HeroSection() {
  const [questions, setQuestions] = useState<string[]>(fallbackQuestions)
  const [stats, setStats] = useState(fallbackStats)

  useEffect(() => {
    getExampleQuestions().then(setQuestions).catch(() => {})
    getSystemStats().then(setStats).catch(() => {})
  }, [])

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-brand-50/60 to-transparent" />
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8 pt-24 pb-20 text-center">
        <div className="mx-auto max-w-3xl">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm text-brand-700 ring-1 ring-brand-200">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
            ข้อมูลอัพเดทล่าสุด: 20 มี.ค. 2569
          </div>

          {/* Heading */}
          <h1 className="font-heading font-bold tracking-tight text-gray-900">
            <span className="block text-3xl sm:text-5xl">ค้นคว้ากฎหมาย</span>
            <span className="block mt-2 text-3xl sm:text-5xl text-brand-600">ด้วย AI อัจฉริยะ</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-5 text-base sm:text-lg leading-7 sm:leading-8 text-gray-500 max-w-xl mx-auto">
            ถามเป็นภาษาธรรมชาติ — ระบบค้นหากฎหมาย มาตรา และคำพิพากษาศาลฎีกาที่เกี่ยวข้องให้อัตโนมัติ
          </p>

          {/* Search Preview */}
          <div className="mt-10 mx-auto max-w-2xl">
            <Link
              to="/chat"
              className="glow block rounded-2xl bg-white ring-1 ring-gray-200 p-1.5 shadow-lg hover:ring-brand-300 hover:shadow-xl transition-all group"
            >
              <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-5 py-4 group-hover:bg-brand-50/40 transition">
                <svg className="h-5 w-5 text-brand-500 shrink-0" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <span className="flex-1 text-sm text-gray-400 text-left">
                  <TypewriterText texts={questions} />
                </span>
                <span className="ml-auto shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white group-hover:bg-brand-700 transition shadow-sm">
                  ถาม AI
                </span>
              </div>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="stat-card rounded-2xl bg-white p-6 ring-1 ring-gray-200 shadow-sm text-left"
            >
              <p className="font-heading text-3xl font-bold text-gray-900">{stat.value}</p>
              <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
              <div className={`mt-3 flex items-center gap-1 text-xs ${stat.has_trend ? 'text-brand-600' : 'text-gray-500'}`}>
                {stat.has_trend ? (
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
      </div>
    </section>
  )
}
