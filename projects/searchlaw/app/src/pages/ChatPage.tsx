import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getConversations, createConversation, deleteConversation, getMessages, createMessage, sendChatToAI, updateConversationTitle } from '../lib/api'
import ChatSidebar from '../components/chat/ChatSidebar'
import ChatMessage from '../components/chat/ChatMessage'
import ChatInput from '../components/chat/ChatInput'
import LawViewer from '../components/chat/LawViewer'

interface Conversation {
  id: string
  title: string
  description?: string | null
  created_at: string
  updated_at: string
}

interface Message {
  id: string
  role: 'user' | 'ai'
  content: string
  citations?: unknown[]
  court_decisions?: unknown[]
  summary?: string[]
  follow_up_questions?: string[]
}

export default function ChatPage() {
  const { user, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerCitation, setViewerCitation] = useState<{ title: string; sections: string[] } | null>(null)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeConversation = conversations.find((c) => c.id === activeConversationId)

  // Load conversations on mount — always start with new chat (no active)
  useEffect(() => {
    getConversations().then(setConversations).catch(() => {})
  }, [])

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      return
    }
    getMessages(activeConversationId).then((data) => {
      setMessages(data.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citations: m.citations as unknown[] ?? [],
        court_decisions: m.court_decisions as unknown[] ?? [],
        summary: m.summary as string[] ?? [],
      })))
    }).catch(() => {})
  }, [activeConversationId])

  // Extract all unique cited laws from conversation
  const citedLaws = useMemo(() => {
    const all = messages.flatMap((m) => (m.citations as { title?: string; sections?: string[]; color?: string }[]) ?? [])
    const unique = new Map<string, { title: string; sections: string[]; color?: string }>()
    for (const c of all) {
      if (c.title && !unique.has(c.title)) {
        unique.set(c.title, { title: c.title, sections: c.sections ?? [], color: c.color })
      }
    }
    return [...unique.values()]
  }, [messages])

  // Auto-open viewer when messages have citations
  useEffect(() => {
    if (citedLaws.length > 0) {
      setViewerCitation(citedLaws[0])
      setViewerOpen(true)
    } else {
      setViewerOpen(false)
      setViewerCitation(null)
    }
  }, [citedLaws])

  // Auto-scroll to latest message (not bottom — so user sees the start of AI response)
  useEffect(() => {
    if (sending) {
      // When loading, scroll to bottom to see loading dots
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else if (messages.length > 0) {
      // When response arrives, scroll to the last AI message start
      const lastMsg = messages[messages.length - 1]
      if (lastMsg.role === 'ai') {
        const el = document.getElementById(`msg-${lastMsg.id}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages, sending])

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), [])

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null)
    setMessages([])
    setViewerOpen(false)
    setViewerCitation(null)
  }, [])

  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      await deleteConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeConversationId === id) {
        setActiveConversationId(null)
        setMessages([])
        setViewerOpen(false)
      }
    } catch {
      // ignore
    }
  }, [activeConversationId])

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id)
  }, [])

  const handleSend = useCallback(async (content: string) => {
    if (!content.trim()) return

    let convId = activeConversationId
    let isNewConv = false

    // Auto-create conversation if none
    if (!convId) {
      try {
        const title = content.length > 40 ? content.slice(0, 40) + '…' : content
        const conv = await createConversation(title)
        setConversations((prev) => [conv, ...prev])
        setActiveConversationId(conv.id)
        convId = conv.id
        isNewConv = true
      } catch {
        return
      }
    }

    // Save user message
    try {
      const userMsg = await createMessage(convId!, 'user', content)
      setMessages((prev) => [...prev, {
        id: userMsg.id,
        role: 'user',
        content: userMsg.content,
      }])
    } catch {
      return
    }

    // Call AI via Edge Function
    setSending(true)
    try {
      const aiMsg = await sendChatToAI(convId!, content)
      setMessages((prev) => [...prev, {
        id: aiMsg.id,
        role: 'ai',
        content: aiMsg.content,
        citations: aiMsg.citations ?? [],
        court_decisions: aiMsg.court_decisions ?? [],
        summary: aiMsg.summary ?? [],
        follow_up_questions: aiMsg.follow_up_questions ?? [],
      }])

      // Auto-generate title + description from first message
      if (isNewConv && convId) {
        const shortTitle = content.replace(/[?？]/g, '').trim()
        const title = shortTitle.length > 35 ? shortTitle.slice(0, 33) + '…' : shortTitle
        const firstLine = aiMsg.content.split('\n')[0]?.replace(/\*\*/g, '').trim() || ''
        const description = firstLine.length > 50 ? firstLine.slice(0, 48) + '…' : firstLine
        try {
          await updateConversationTitle(convId, title, description)
          setConversations((prev) => prev.map((c) =>
            c.id === convId ? { ...c, title, description } : c
          ))
        } catch {}
      }
    } catch (err) {
      // Fallback: save error message locally (don't save to DB)
      setMessages((prev) => [...prev, {
        id: 'error-' + Date.now(),
        role: 'ai',
        content: 'ขออภัย ไม่สามารถเชื่อมต่อ AI ได้ในขณะนี้ กรุณาลองอีกครั้ง',
      }])
      console.error('AI error:', err)
    } finally {
      setSending(false)
    }
  }, [activeConversationId])

  return (
    <div className="flex h-dvh overflow-hidden">
      <ChatSidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        user={user}
        onLogout={signOut}
        onNewChat={handleNewChat}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
      />

      {/* Center — Chat Panel */}
      <main id="chat-main" className="flex-1 flex flex-col h-full min-w-0">
        {/* Chat Header */}
        <header className="shrink-0 border-b border-gray-200 bg-white px-3 md:px-4 py-2.5 flex items-center gap-3">
          <Link
            to="/"
            className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
            aria-label="กลับหน้าหลัก"
          >
            <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="font-heading text-sm font-semibold text-gray-900 truncate">
              {activeConversation?.title ?? 'แชทใหม่'}
            </h1>
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin bg-gray-50/50">
          <div className="mx-auto max-w-3xl px-6 py-8 space-y-8">
            {messages.length === 0 && !sending && (
              <div className="flex flex-col items-center justify-center py-24 px-4">
                {/* Icon */}
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 ring-1 ring-brand-200 mb-6">
                  <svg className="h-8 w-8 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>

                <h2 className="font-heading text-xl font-bold text-gray-900">ถามคำถามกฎหมายได้เลย</h2>
                <p className="mt-2 text-sm text-gray-500 text-center max-w-md">
                  พิมพ์คำถามด้านล่าง ระบบจะค้นหากฎหมาย มาตรา และคำพิพากษาศาลฎีกาที่เกี่ยวข้องให้อัตโนมัติ
                </p>

                {/* Suggestion chips */}
                <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-lg">
                  {[
                    'เปิดซาวน่าในโรงแรม ต้องขออนุญาตอะไร?',
                    'สัญญาเช่าที่ดิน 30 ปี',
                    'เลิกจ้างพนักงาน จ่ายชดเชยเท่าไร?',
                    'ภาษีที่ดินสำหรับคอนโด',
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="rounded-full bg-white px-4 py-2 text-sm text-gray-600 ring-1 ring-gray-200 transition hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-300"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} id={`msg-${msg.id}`}>
              <ChatMessage
                type={msg.role === 'user' ? 'user' : 'ai'}
                content={msg.content}
                citations={msg.citations as never[]}
                courtDecisions={msg.court_decisions as never[]}
                summary={msg.summary}
                onCitationClick={(index: number) => {
                  const allCitations = messages
                    .flatMap((m) => (m.citations as { index?: number; title?: string; sections?: string[] }[]) ?? [])
                  const clicked = allCitations.find((c) => c.index === index)
                  if (clicked?.title) {
                    setViewerCitation({ title: clicked.title, sections: clicked.sections ?? [] })
                  }
                  setViewerOpen(true)
                }}
                onSectionClick={(lawTitle: string, section: string) => {
                  const sections = section.includes(',') ? section.split(',').map(s => s.trim()) : [section]
                  setViewerCitation({ title: lawTitle, sections })
                  setViewerOpen(true)
                }}
              />
              </div>
            ))}
            {sending && (
              <ChatMessage type="loading" />
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <ChatInput
          onSend={handleSend}
          disabled={sending}
          followUps={(() => {
            const lastAi = [...messages].reverse().find(m => m.role === 'ai')
            return lastAi?.follow_up_questions ?? []
          })()}
        />
      </main>

      {viewerOpen && (
        <LawViewer
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          activeCitation={viewerCitation}
          citedLaws={citedLaws}
        />
      )}
    </div>
  )
}
