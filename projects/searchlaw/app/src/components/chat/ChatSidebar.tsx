import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import BookIcon from '../ui/BookIcon'

interface Conversation {
  id: string
  title: string
  description?: string | null
  created_at: string
  updated_at: string
}

interface ChatSidebarProps {
  isOpen: boolean
  onToggle: () => void
  user: { email?: string } | null
  onLogout: () => void
  onNewChat: () => void
  conversations: Conversation[]
  activeConversationId: string | null
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
}

function getInitials(email: string): string {
  const name = email.split('@')[0]
  if (name.length < 2) return name.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function groupByDate(conversations: Conversation[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const week = new Date(today.getTime() - 7 * 86400000)

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'วันนี้', items: [] },
    { label: 'เมื่อวาน', items: [] },
    { label: '7 วันก่อน', items: [] },
    { label: 'เก่ากว่า', items: [] },
  ]

  for (const c of conversations) {
    const d = new Date(c.updated_at)
    if (d >= today) groups[0].items.push(c)
    else if (d >= yesterday) groups[1].items.push(c)
    else if (d >= week) groups[2].items.push(c)
    else groups[3].items.push(c)
  }

  return groups.filter((g) => g.items.length > 0)
}

export default function ChatSidebar({
  isOpen, onToggle, user, onLogout, onNewChat,
  conversations, activeConversationId, onSelectConversation, onDeleteConversation,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    const list = q ? conversations.filter((c) => c.title.toLowerCase().includes(q)) : conversations
    return groupByDate(list)
  }, [conversations, searchQuery])

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/30 lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Collapsed icon strip (desktop only) */}
      {!isOpen && (
        <div className="hidden lg:flex flex-col items-center justify-between border-r border-gray-200 bg-white py-3 px-1.5 h-full">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onToggle}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
              aria-label="เปิดแถบประวัติแชท"
            >
              <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <button
              onClick={onNewChat}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
              aria-label="แชทใหม่"
            >
              <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 transition"
            aria-label="ออกจากระบบ"
            title="ออกจากระบบ"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      )}

      {/* Full sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-60 h-dvh w-[280px] border-r border-gray-200 bg-white
          flex flex-col transition-transform duration-200 ease-out
          lg:static lg:z-auto lg:w-60
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:hidden'}
        `}
        role="complementary"
        aria-label="ประวัติแชท"
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-100 px-4 pt-4 pb-4">
          <div className="mb-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
                <BookIcon className="h-4.5 w-4.5" />
              </div>
              <span className="font-heading text-[17px] font-bold text-gray-900">Legal AI</span>
            </Link>
            <button
              onClick={onToggle}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
              aria-label="เก็บแถบประวัติแชท"
            >
              <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          </div>
          <button
            onClick={onNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 active:bg-brand-800 shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            แชทใหม่
          </button>
        </div>

        {/* Search */}
        <div className="flex-shrink-0 px-4 pt-4 pb-2">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="ค้นหาแชท..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pr-3 pl-10 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>

        {/* Chat history list */}
        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-2">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-400">
              {conversations.length === 0 ? 'ยังไม่มีประวัติแชท' : 'ไม่พบแชท'}
            </p>
          )}
          {filtered.map((group) => (
            <div key={group.label} className="mb-3">
              <h3 className="mb-1.5 px-2 pt-2 text-xs font-semibold tracking-wide text-brand-500">
                {group.label}
              </h3>
              <ul role="list" className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.id === activeConversationId
                  return (
                    <li key={item.id} className="group/item relative">
                      <button
                        onClick={() => onSelectConversation(item.id)}
                        className={`flex w-full rounded-xl px-3 py-3 pr-9 text-left transition-all duration-150 ${
                          isActive
                            ? 'bg-brand-50 ring-1 ring-brand-200 shadow-sm'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className={`text-[13px] leading-snug truncate ${isActive ? 'font-bold text-brand-800' : 'font-semibold text-gray-900'}`}>
                            {item.title}
                          </p>
                          {item.description && (
                            <p className={`mt-1 text-[11px] leading-tight truncate ${isActive ? 'text-brand-500' : 'text-gray-400'}`}>
                              {item.description}
                            </p>
                          )}
                        </div>
                      </button>
                      {/* Delete button — visible on hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget(item)
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover/item:opacity-100"
                        aria-label={`ลบแชท ${item.title}`}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom user area */}
        {user && (
          <div className="flex-shrink-0 border-t border-gray-100 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                {getInitials(user.email ?? '')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-700">{user.email ?? ''}</p>
              </div>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                aria-label="ออกจากระบบ"
                title="ออกจากระบบ"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Logout confirmation modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-200">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 mb-4">
              <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </div>
            <h3 className="font-heading text-lg font-bold text-gray-900">ออกจากระบบ?</h3>
            <p className="mt-1 text-sm text-gray-500">
              คุณต้องการออกจากระบบ Legal AI ใช่หรือไม่?
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false)
                  onLogout()
                }}
                className="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-200">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 mb-4">
              <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <h3 className="font-heading text-lg font-bold text-gray-900">ลบแชทนี้?</h3>
            <p className="mt-1 text-sm text-gray-500">
              "{deleteTarget.title}" จะถูกลบอย่างถาวร รวมถึงข้อความทั้งหมดในแชทนี้
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  onDeleteConversation(deleteTarget.id)
                  setDeleteTarget(null)
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
              >
                ลบแชท
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
