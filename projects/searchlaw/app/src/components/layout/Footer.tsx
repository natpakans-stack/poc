import BookIcon from '../ui/BookIcon'

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-brand-600">
            <BookIcon className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm text-gray-500">Legal AI — Internal Use Only</span>
        </div>
        <p className="text-xs text-gray-400">แหล่งข้อมูล: สำนักงานคณะกรรมการกฤษฎีกา (ocs.go.th) · ศาลฎีกา · ราชกิจจานุเบกษา</p>
      </div>
    </footer>
  )
}
