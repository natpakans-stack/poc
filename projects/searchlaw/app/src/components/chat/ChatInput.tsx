import { useState, useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  followUps?: string[]
}

export default function ChatInput({ onSend, disabled = false, followUps = [] }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = '24px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }, [])

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    adjustHeight()
  }

  const handleSend = useCallback(() => {
    const trimmed = message.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setMessage('')
    if (textareaRef.current) {
      textareaRef.current.style.height = '24px'
    }
  }, [message, disabled, onSend])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-3">
      <div className="mx-auto max-w-3xl">
        {/* Quick Reply Capsules */}
        {followUps.length > 0 && !disabled && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {followUps.map((q, i) => (
              <button
                key={i}
                onClick={() => onSend(q)}
                className="rounded-full bg-brand-50 px-3 py-1.5 text-xs text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-100 hover:ring-brand-300 active:bg-brand-200 max-w-[280px] truncate"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 transition-colors focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="พิมพ์คำถามกฎหมาย..."
            disabled={disabled}
            rows={1}
            className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent text-sm leading-relaxed text-gray-800 placeholder:text-gray-400 focus:outline-none disabled:opacity-50"
            aria-label="ข้อความแชท"
          />
          <button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 active:bg-brand-800 disabled:bg-gray-300 disabled:text-gray-500"
            aria-label="ส่งข้อความ"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-400">
          Legal AI ใช้ข้อมูลจาก ocs.go.th · v1.2 · กด Enter เพื่อส่ง
        </p>
      </div>
    </div>
  )
}
