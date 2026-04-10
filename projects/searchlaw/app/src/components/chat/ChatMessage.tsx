import React from 'react'
import CitationCard from './CitationCard'

interface Citation {
  index: number
  title: string
  description: string
  status: 'active' | 'check'
  sections: string[]
  color: 'green' | 'purple' | 'blue'
}

interface CourtDecision {
  id: string
  title?: string
  summary?: string
  text?: string
}

interface ChatMessageProps {
  type: 'user' | 'ai' | 'loading'
  content?: string
  citations?: Citation[]
  courtDecisions?: CourtDecision[]
  summary?: string[]
  onCitationClick?: (index: number) => void
  onSectionClick?: (lawTitle: string, section: string) => void
}

function AiAvatar() {
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="skeleton h-6 w-6 rounded-full" />
        <div className="skeleton h-4 w-40" />
      </div>
      <div className="mb-2 skeleton h-3 w-full" />
      <div className="skeleton h-3 w-3/4" />
    </div>
  )
}

function LoadingMessage() {
  return (
    <div className="chat-msg flex gap-3">
      <AiAvatar />
      <div className="max-w-[720px] flex-1 space-y-3">
        {/* Typing dots + estimated time */}
        <div className="flex items-center gap-3 rounded-2xl rounded-tl-md bg-gray-50 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
          <span className="text-xs text-gray-400">กำลังค้นหากฎหมาย · ประมาณ 10-15 วินาที</span>
        </div>
        {/* Skeleton citation cards */}
        <div className="grid gap-2 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  )
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="chat-msg flex justify-end">
      <div className="max-w-[480px] rounded-2xl rounded-tr-md bg-brand-600 px-4 py-3 text-sm leading-relaxed text-white">
        {content}
      </div>
    </div>
  )
}

function AiMessage({
  content,
  citations,
  courtDecisions,
  summary,
  onSectionClick,
}: Omit<ChatMessageProps, 'type'>) {
  return (
    <div className="chat-msg flex gap-3">
      <AiAvatar />
      <div className="max-w-[720px] flex-1 space-y-4">
        {/* Main text content — supports basic markdown */}
        {content && (
          <div className="rounded-2xl rounded-tl-md bg-gray-50 px-5 py-4 text-sm leading-relaxed text-gray-800">
            {(() => {
              const lines = content.split('\n')
              const elements: React.ReactElement[] = []
              let i = 0
              const bold = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-900">$1</strong>')

              while (i < lines.length) {
                const trimmed = lines[i].trim()

                // Empty line
                if (!trimmed) { elements.push(<div key={i} className="h-2" />); i++; continue }

                // Table: detect | col1 | col2 | pattern
                if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
                  const tableRows: string[][] = []
                  while (i < lines.length && lines[i].trim().startsWith('|')) {
                    const row = lines[i].trim()
                    // Skip separator row |---|---|
                    if (/^\|[\s\-:|]+\|$/.test(row)) { i++; continue }
                    const cells = row.split('|').filter(Boolean).map(c => c.trim())
                    tableRows.push(cells)
                    i++
                  }
                  if (tableRows.length > 0) {
                    elements.push(
                      <div key={`table-${i}`} className="my-3 overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              {tableRows[0].map((cell, ci) => (
                                <th key={ci} className="px-3 py-2 text-left font-semibold text-gray-900 border-b border-gray-200" dangerouslySetInnerHTML={{ __html: bold(cell) }} />
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tableRows.slice(1).map((row, ri) => (
                              <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                {row.map((cell, ci) => (
                                  <td key={ci} className="px-3 py-2 border-b border-gray-100 text-gray-700" dangerouslySetInnerHTML={{ __html: bold(cell) }} />
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  }
                  continue
                }

                // H2
                if (trimmed.startsWith('## ')) {
                  const hText = trimmed.replace('## ', '').replace(/^\*\*(.+)\*\*$/, '$1')
                  elements.push(<h3 key={i} className="mt-5 mb-2 font-heading text-base font-bold text-gray-900 border-b border-gray-200 pb-2">{hText}</h3>)
                  i++; continue
                }
                // H3
                if (trimmed.startsWith('### ')) {
                  const hText = trimmed.replace('### ', '').replace(/^\*\*(.+)\*\*$/, '$1')
                  elements.push(<h4 key={i} className="mt-4 mb-1 font-heading text-sm font-bold text-gray-900">{hText}</h4>)
                  i++; continue
                }
                // Standalone bold line **text** → treat as subheading
                if (/^\*\*(.+)\*\*$/.test(trimmed)) {
                  const text = trimmed.replace(/^\*\*/, '').replace(/\*\*$/, '')
                  elements.push(<h4 key={i} className="mt-4 mb-1 font-heading text-sm font-bold text-gray-900">{text}</h4>)
                  i++; continue
                }
                // Bullet
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                  elements.push(<li key={i} className="ml-4 list-disc text-gray-700" dangerouslySetInnerHTML={{ __html: bold(trimmed.substring(2)) }} />)
                  i++; continue
                }
                // Numbered
                if (/^\d+\.\s/.test(trimmed)) {
                  elements.push(<li key={i} className="ml-4 list-decimal text-gray-700" dangerouslySetInnerHTML={{ __html: bold(trimmed.replace(/^\d+\.\s/, '')) }} />)
                  i++; continue
                }
                // HR
                if (trimmed === '---') { elements.push(<hr key={i} className="my-3 border-gray-200" />); i++; continue }
                // Paragraph
                elements.push(<p key={i} className={i > 0 ? 'mt-2' : ''} dangerouslySetInnerHTML={{ __html: bold(trimmed) }} />)
                i++
              }
              return elements
            })()}
          </div>
        )}

        {/* Citation cards */}
        {citations && citations.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {citations.map((citation) => (
              <CitationCard
                key={citation.index}
                index={citation.index}
                title={citation.title}
                description={citation.description}
                status={citation.status}
                sections={citation.sections}
                color={citation.color}
                onClick={() => onSectionClick?.(citation.title, citation.sections?.join(',') ?? '')}
                onSectionClick={(section) => onSectionClick?.(citation.title, section)}
              />
            ))}
          </div>
        )}

        {/* Color legend */}
        {citations && citations.length > 1 && (
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-600" />กฎหมายหลัก</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-600" />กฎหมายรอง/คำพิพากษา</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-600" />กฎหมายเสริม</span>
          </div>
        )}

        {/* Court decisions */}
        {courtDecisions && courtDecisions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              คำพิพากษาที่เกี่ยวข้อง
            </h4>
            {courtDecisions.map((decision) => (
              <div
                key={decision.id}
                className="rounded-lg border border-gray-200 bg-white p-3"
              >
                <p className="mb-1 text-sm font-semibold text-gray-800">{decision.title ?? decision.id}</p>
                <p className="text-xs leading-relaxed text-gray-600">{decision.summary ?? decision.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Summary box */}
        {summary && summary.length > 0 && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <svg className="h-4 w-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <h4 className="text-sm font-bold text-brand-800">สรุป</h4>
            </div>
            <ul className="space-y-1.5">
              {summary.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-brand-900">
                  <span className="mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-brand-200 text-[10px] font-bold text-brand-800">
                    {i + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-gray-400">
          ⚖️ ข้อมูลจาก Legal AI มีไว้เพื่อประกอบการตัดสินใจเท่านั้น ไม่ใช่คำแนะนำทางกฎหมาย กรุณาปรึกษาทนายความสำหรับกรณีเฉพาะ
        </p>
      </div>
    </div>
  )
}

export default function ChatMessage({
  type,
  content,
  citations,
  courtDecisions,
  summary,
  onCitationClick,
  onSectionClick,
}: ChatMessageProps) {
  if (type === 'loading') return <LoadingMessage />
  if (type === 'user') return <UserMessage content={content ?? ''} />
  return (
    <AiMessage
      content={content}
      citations={citations}
      courtDecisions={courtDecisions}
      summary={summary}
      onCitationClick={onCitationClick}
      onSectionClick={onSectionClick}
    />
  )
}
