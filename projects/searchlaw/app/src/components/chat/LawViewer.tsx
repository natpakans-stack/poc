import { useState, useRef, useCallback, useEffect } from 'react'
import { getLawWithSections } from '../../lib/api'
import { supabase } from '../../lib/supabase'

interface LawSection {
  id: string
  number: string
  title: string
  content: string
  cited?: boolean
}

interface Law {
  id?: string
  title: string
  source: string
  sections: LawSection[]
}

interface LawViewerProps {
  isOpen: boolean
  onClose: () => void
  law?: Law | null
  activeCitation?: { title: string; sections: string[] } | null
  citedLaws?: { title: string; sections: string[]; color?: string }[]
}

const MIN_WIDTH = 280
const MAX_WIDTH = 800
const DEFAULT_WIDTH = 560

export default function LawViewer({ isOpen, onClose, law, activeCitation, citedLaws = [] }: LawViewerProps) {
  const [tabs, setTabs] = useState<{ id: string; label: string; color?: string }[]>([])
  const [activeTab, setActiveTab] = useState('')
  const [currentLaw, setCurrentLaw] = useState<Law | null>(null)
  const [expandedToc, setExpandedToc] = useState(false)
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH)
  const [activeSection, setActiveSection] = useState<string | null>('s3')
  const isResizing = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Build tabs from citedLaws (from chat citations)
  useEffect(() => {
    if (!isOpen) return
    if (law) {
      setCurrentLaw(law)
      setTabs([{ id: 'prop', label: law.title }])
      setActiveTab('prop')
      return
    }
    if (citedLaws.length === 0) return

    // Core laws — exact ID mapping to avoid fuzzy search returning wrong law
    const CORE_LAWS: Record<string, string> = {
      'ประมวลกฎหมายแพ่งและพาณิชย์': 'b35df21c-434e-4572-990e-0553693049ed',
      'ประมวลกฎหมายอาญา': '9d8930f5-643f-4d6a-b8d6-a032cc0d2c16',
      'ประมวลกฎหมายวิธีพิจารณาความแพ่ง': 'd49d4cec-a41a-4ce7-8dc2-dd91be434e0a',
      'ประมวลกฎหมายวิธีพิจารณาความอาญา': 'f5601fae-97ca-4fa4-b84d-5d8ef0f0666d',
      'ประมวลรัษฎากร': 'cf985c11-6f72-44a5-9161-d608b092aef8',
      'พระราชบัญญัติคุ้มครองแรงงาน': 'a292bec6-44f4-4ff4-9c88-1652fc467b04',
      'พระราชบัญญัติแรงงานสัมพันธ์': '264beae4-74ff-44b1-81a8-1929e618cc14',
      'พระราชบัญญัติประกันสังคม': '91a0f0f4-d5a3-42dd-a0c4-a51ecde01777',
      'พระราชบัญญัติบริษัทมหาชนจำกัด': '1a960651-e944-4281-bc56-a90eefee5017',
      'พระราชบัญญัติหลักทรัพย์และตลาดหลักทรัพย์': 'ddd9b9c9-1a3d-4089-b10b-fd0fb9238cfe',
      'พระราชบัญญัติการแข่งขันทางการค้า': 'a7375ca1-3ad4-43c2-9697-a7eb806dd5a9',
      'พระราชบัญญัติโรงงาน': 'a9bb42c8-864e-4ed4-a57d-2b614160e79d',
      'พระราชบัญญัติทะเบียนพาณิชย์': '7e44fe47-efe9-459a-9049-9e3d35e54b05',
      'พระราชบัญญัติการสาธารณสุข': 'edea3576-d263-4353-9d8d-dcfbc158e21b',
      'พระราชบัญญัติอาหาร': '9e8790bb-8dab-4f33-a1e8-d97386e60cde',
      'พระราชบัญญัติว่าด้วยความผิดอันเกิดจากการใช้เช็ค': '15ada837-f9c1-414a-9c6f-07711fa54e50',
    }

    // Search DB for each cited law title → get its ID for loading sections
    async function findLaws() {
      const foundTabs: { id: string; label: string; color?: string }[] = []
      for (const cited of citedLaws) {
        let found: { id: string; title: string } | null = null

        // Strategy 0: Exact match against core laws (prevents wrong fuzzy matches)
        for (const [coreName, coreId] of Object.entries(CORE_LAWS)) {
          if (cited.title === coreName || cited.title.includes(coreName) || coreName.includes(cited.title.replace(/ พ\.ศ\..*$/, '').trim())) {
            found = { id: coreId, title: coreName }
            break
          }
        }

        if (!found) {
          // Extract keywords from title
          const raw = cited.title
            .replace(/พ\.ร\.บ\.\s*/g, '')
            .replace(/พ\.ร\.ก\.\s*/g, '')
            .replace(/พระราชบัญญัติ/g, '')
            .replace(/พระราชกำหนด/g, '')
            .replace(/ประมวลกฎหมาย/g, '')
            .replace(/พ\.ศ\.\s*/g, '')
            .replace(/การประกอบ|ธุรกิจ|กิจการ/g, '')
            .replace(/\d{4}/g, '')
            .trim()

          // Get core keywords (longest words)
          const keywords = raw.split(/\s+/).filter(w => w.length > 2).slice(0, 3)

          // Strategy 1: exact title match first
          const { data: exactData } = await supabase.from('laws').select('id, title')
            .ilike('title', `%${cited.title.replace(/ พ\.ศ\..*$/, '').trim().substring(0, 50)}%`).limit(3)
          // Pick the one whose title is closest (shortest = most specific match)
          if (exactData?.length) {
            found = exactData.sort((a, b) => a.title.length - b.title.length)[0]
          }

          // Strategy 2: keyword search fallback
          if (!found) {
            for (const kw of keywords) {
              if (found) break
              const { data } = await supabase.from('laws').select('id, title').ilike('title', `%${kw}%`).limit(3)
              // Prefer shortest title (most specific match)
              if (data?.length) found = data.sort((a, b) => a.title.length - b.title.length)[0]
            }
          }
        }

        if (found) {
          const shortLabel = found.title
            .replace(/พระราชบัญญัติ/, 'พ.ร.บ.')
            .replace(/พระราชกำหนด/, 'พ.ร.ก.')
            .replace(/ พ\.ศ\.\s?\d+/, '')
          foundTabs.push({ id: found.id, label: shortLabel.length > 30 ? shortLabel.substring(0, 28) + '…' : shortLabel, color: cited.color })
        } else {
          foundTabs.push({ id: `cited-${cited.title}`, label: cited.title.substring(0, 28) + (cited.title.length > 28 ? '…' : ''), color: cited.color })
        }
      }
      if (foundTabs.length > 0) {
        setTabs(foundTabs)
        if (!activeTab || !foundTabs.find((t) => t.id === activeTab)) {
          setActiveTab(foundTabs[0].id)
        }
      }
    }
    findLaws()
  }, [isOpen, law, citedLaws])

  // Load law content when tab changes
  useEffect(() => {
    if (!activeTab || activeTab === 'prop' || activeTab.startsWith('cited-') || law) return
    getLawWithSections(activeTab).then((data) => {
      setCurrentLaw({
        id: data.id,
        title: data.title,
        source: data.source ?? '',
        sections: data.sections.map((s: { id: string; number: string; title: string; content: string }) => ({
          id: s.id,
          number: s.number,
          title: s.title,
          content: s.content,
        })),
      })
    }).catch(() => {})
  }, [activeTab, law])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const startX = e.clientX
    const startWidth = panelWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return
      const delta = startX - moveEvent.clientX
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta))
      setPanelWidth(newWidth)
    }

    const handleMouseUp = () => {
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [panelWidth])

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId)
    const el = document.getElementById(`law-section-${sectionId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // When activeCitation changes, find matching tab and switch to it
  useEffect(() => {
    if (!activeCitation || !tabs.length) return
    // Extract core keywords for flexible matching
    const normalize = (s: string) => s.replace(/พระราชบัญญัติ|พ\.ร\.บ\.|พ\.ร\.ก\.|พระราชกำหนด/g, '').replace(/พ\.ศ\.\s*\d+/g, '').replace(/\s+/g, '').trim()
    const citedCore = normalize(activeCitation.title)

    const match = tabs.find((t) => {
      const tabCore = normalize(t.label)
      return (citedCore.length > 3 && tabCore.includes(citedCore.substring(0, Math.min(citedCore.length, 12)))) ||
             (tabCore.length > 3 && citedCore.includes(tabCore.substring(0, Math.min(tabCore.length, 12))))
    })

    if (match) {
      // Always switch tab when citation changes (even if same tab)
      setActiveTab(match.id)
    }
  }, [activeCitation?.title, JSON.stringify(activeCitation?.sections), tabs])

  // Reset active section + mark cited + scroll when citation changes
  useEffect(() => {
    if (!isOpen || !currentLaw) return

    // Exact match function: "มาตรา 5" should NOT match "มาตรา 15" or "มาตรา 50"
    function matchSection(sectionNumber: string, citedName: string): boolean {
      const sn = sectionNumber.trim()
      const cn = citedName.trim()
      if (sn === cn) return true
      // Extract prefix + number: "มาตรา 5" → prefix="มาตรา", num="5"
      const snMatch = sn.match(/^(.+?)\s*(\d[\d/]*)$/)
      const cnMatch = cn.match(/^(.+?)\s*(\d[\d/]*)$/)
      if (snMatch && cnMatch) {
        // Both must have same prefix type (มาตรา=มาตรา, ข้อ=ข้อ) AND same number
        const snPrefix = snMatch[1].trim()
        const cnPrefix = cnMatch[1].trim()
        const snNum = snMatch[2]
        const cnNum = cnMatch[2]
        // If cited is "มาตรา X", only match sections that start with "มาตรา"
        if (cnPrefix === 'มาตรา') return snPrefix === 'มาตรา' && snNum === cnNum
        return snNum === cnNum && snPrefix === cnPrefix
      }
      return false
    }

    // Mark sections as cited
    let firstCitedId: string | null = null
    if (activeCitation?.sections?.length) {
      const updated = currentLaw.sections.map((s) => {
        const isCited = activeCitation.sections.some((cn) => matchSection(s.number, cn))
        if (isCited && !firstCitedId) firstCitedId = s.id
        return { ...s, cited: isCited }
      })
      setCurrentLaw({ ...currentLaw, sections: updated })
    }

    // Scroll to first cited section
    const targetId = firstCitedId ?? currentLaw.sections[0]?.id
    if (targetId) {
      setActiveSection(targetId)
      setTimeout(() => {
        const el = document.getElementById(`law-section-${targetId}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 400)
    }
  }, [isOpen, currentLaw?.id, activeCitation?.title, JSON.stringify(activeCitation?.sections)])

  if (!isOpen) return null
  if (!currentLaw) {
    // If active tab is a fallback (not in DB), show placeholder
    if (activeTab?.startsWith('cited-')) {
      const citedTitle = activeTab.replace('cited-', '')
      return (
        <>
          <div className="hidden lg:flex h-full w-3 shrink-0 cursor-col-resize items-center justify-center group select-none" />
          <div className="hidden lg:flex flex-col items-center justify-center border-l border-gray-200 bg-white px-8 text-center" style={{ width: `${panelWidth}px` }}>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 mb-4">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900">{citedTitle}</p>
            <p className="mt-1 text-xs text-gray-400">ยังไม่มีข้อมูลกฎหมายฉบับนี้ในระบบ</p>
          </div>
        </>
      )
    }
    return (
      <>
        <div className="hidden lg:flex h-full w-3 shrink-0 cursor-col-resize items-center justify-center group select-none" />
        <div className="hidden lg:flex items-center justify-center border-l border-gray-200 bg-white" style={{ width: `${panelWidth}px` }}>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      </>
    )
  }

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Resize handle — separate element OUTSIDE the panel (desktop only) */}
      <div
        className="hidden lg:flex h-full w-3 shrink-0 cursor-col-resize items-center justify-center group select-none"
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="ลากเพื่อปรับขนาดแผง"
      >
        <div className="h-full w-px bg-gray-200 group-hover:bg-brand-400 group-active:bg-brand-600 transition-colors" />
        <div className="absolute flex flex-col gap-[3px] rounded-full bg-gray-100 group-hover:bg-brand-100 px-[3px] py-2 transition-colors">
          <div className="h-[3px] w-[3px] rounded-full bg-gray-400 group-hover:bg-brand-500 transition-colors" />
          <div className="h-[3px] w-[3px] rounded-full bg-gray-400 group-hover:bg-brand-500 transition-colors" />
          <div className="h-[3px] w-[3px] rounded-full bg-gray-400 group-hover:bg-brand-500 transition-colors" />
          <div className="h-[3px] w-[3px] rounded-full bg-gray-400 group-hover:bg-brand-500 transition-colors" />
          <div className="h-[3px] w-[3px] rounded-full bg-gray-400 group-hover:bg-brand-500 transition-colors" />
        </div>
      </div>

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-gray-200 bg-white lg:static lg:z-auto"
        style={{ maxWidth: '100%', width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${panelWidth}px` : undefined }}
        role="complementary"
        aria-label="ตัวแสดงกฎหมาย"
      >

        {/* Header — compact with title */}
        <div className="flex-shrink-0 border-b border-gray-200 px-5 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-brand-50 ring-1 ring-brand-200">
                <svg className="h-3 w-3 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h2 className="font-heading text-xs font-semibold text-gray-900 truncate">{currentLaw.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="ปิด"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs — separate bar, scroll horizontal */}
        <div className="flex-shrink-0 border-b border-gray-200 px-5 py-2 flex gap-1 overflow-x-auto scrollbar-none" role="tablist">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            const colorStyles = {
              green: isActive ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-gray-500 hover:bg-brand-50/50',
              purple: isActive ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-200' : 'text-gray-500 hover:bg-purple-50/50',
              blue: isActive ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'text-gray-500 hover:bg-blue-50/50',
            }
            const style = colorStyles[(tab.color as keyof typeof colorStyles) ?? 'green'] ?? colorStyles.green
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${style}`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Table of Contents — collapsed by default, max height when open */}
        <div className="flex-shrink-0 border-b border-gray-200 px-5 py-2.5">
          <button
            onClick={() => setExpandedToc(!expandedToc)}
            className="flex w-full items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400"
          >
            <svg
              className={`h-3 w-3 transition-transform ${expandedToc ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            สารบัญ ({currentLaw.sections.length})
          </button>
          {expandedToc && (() => {
            const ac = tabs.find(t => t.id === activeTab)?.color ?? 'green'
            const tocColors: Record<string, { active: string; cited: string; badge: string }> = {
              green: { active: 'font-semibold text-brand-700', cited: 'text-brand-600', badge: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' },
              purple: { active: 'font-semibold text-purple-700', cited: 'text-purple-600', badge: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200' },
              blue: { active: 'font-semibold text-blue-700', cited: 'text-blue-600', badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
            }
            const tc = tocColors[ac] ?? tocColors.green
            return (
            <nav className="mt-2 ml-5 max-h-48 overflow-y-auto scrollbar-thin space-y-0.5" aria-label="สารบัญกฎหมาย">
              {currentLaw.sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`block w-full text-left text-xs py-0.5 cursor-pointer truncate ${
                    activeSection === section.id
                      ? tc.active
                      : section.cited
                        ? tc.cited
                        : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {section.number}{section.title !== section.number ? ` — ${section.title}` : ''}
                  {section.cited && (
                    <span className={`ml-1 rounded px-1 py-0.5 text-[9px] ${tc.badge}`}>อ้างถึง</span>
                  )}
                </button>
              ))}
            </nav>
            )
          })()}
        </div>

        {/* Law content */}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-6">
            {(() => {
              const activeColor = tabs.find(t => t.id === activeTab)?.color ?? 'green'
              const highlightStyles: Record<string, { border: string; heading: string; badge: string }> = {
                green: { border: 'viewer-highlight', heading: 'text-brand-600', badge: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' },
                purple: { border: 'viewer-highlight-purple', heading: 'text-purple-600', badge: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200' },
                blue: { border: 'viewer-highlight-blue', heading: 'text-blue-600', badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
              }
              const hs = highlightStyles[activeColor] ?? highlightStyles.green

              return currentLaw.sections.map((section) => (
              <article
                key={section.id}
                id={`law-section-${section.id}`}
                className={section.cited ? `${hs.border} rounded-lg py-3 pr-3` : ''}
              >
                <div className="flex items-center gap-2 mb-2">
                  <p className={`text-xs font-semibold uppercase tracking-wider ${section.cited ? hs.heading : 'text-gray-400'}`}>
                    {section.number}
                  </p>
                  {section.cited && (
                    <span className={`rounded px-1.5 py-0.5 text-[9px] ${hs.badge}`}>
                      อ้างถึงในแชท
                    </span>
                  )}
                </div>
                <div className={`text-xs leading-relaxed whitespace-pre-line ${section.cited ? 'text-gray-700' : 'text-gray-500'}`}>
                  {section.content?.replace(new RegExp(`^${section.number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`), '').trim() || section.content}
                </div>
              </article>
            ))
            })()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 px-5 py-3 bg-gray-50">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-400">แหล่งที่มา: ocs.go.th</p>
            <div className="flex gap-2">
              <button className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-xs text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 transition shadow-sm">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                PDF
              </button>
              <a
                href={currentLaw.source || 'https://www.ocs.go.th'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-xs text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 transition shadow-sm"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                ocs.go.th
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
