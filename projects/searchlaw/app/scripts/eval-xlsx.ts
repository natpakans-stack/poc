/**
 * Eval from Excel test cases
 * Usage: bun scripts/eval-xlsx.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const SUPABASE_URL = 'https://xqmdyjjatkpmjzlqpffr.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxbWR5amphdGtwbWp6bHFwZmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMzU4NjAsImV4cCI6MjA4OTkxMTg2MH0.aUor2u1zo6Q7uzue17g8_UwW5EXYTpM834H7Wk4XQxs'
const EMAIL = 'natpakan.s@real-factory.co'
const PASSWORD = 'YArGuvEjn6KuHvZh'

const supabase = createClient(SUPABASE_URL, ANON_KEY)

// Read Excel
const buf = await Bun.file('/Users/natpakansirirat/Downloads/thai_law_ai_testcases.xlsx').arrayBuffer()
const wb = XLSX.read(buf)
const ws = wb.Sheets[wb.SheetNames[0]]
const raw = XLSX.utils.sheet_to_json(ws) as any[]

// Parse test cases (skip header row)
const cases = raw.slice(1).map(r => ({
  id: r['Thai Law AI — Master Test Case Dataset (v1.0)'],
  category: r['__EMPTY'],
  difficulty: r['__EMPTY_1'],
  query: r['__EMPTY_3'],
  expectedLaws: r['__EMPTY_4'],
  expectedQuality: r['__EMPTY_5'],
  hallucinationRisk: r['__EMPTY_6'],
  notes: r['__EMPTY_7'],
})).filter(c => c.query)

console.log(`📋 ${cases.length} test cases loaded\n`)

// Login
const { error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1) }

const results: any[] = []

for (const c of cases) {
  process.stdout.write(`[${c.id}] ${c.difficulty} | ${c.query.substring(0, 40)}... `)

  try {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: conv } = await supabase.from('conversations').insert({ user_id: user!.id, title: `eval-v2-${c.id}` }).select().single()
    if (!conv) { console.log('❌ Conv fail'); continue }

    await supabase.from('messages').insert({ conversation_id: conv.id, role: 'user', content: c.query, citations: [], court_decisions: [], summary: [] })

    const start = Date.now()
    const { data, error } = await supabase.functions.invoke('chat', { body: { conversationId: conv.id, message: c.query } })
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    if (error) {
      console.log(`❌ ${elapsed}s`)
      results.push({ ...c, status: 'ERROR', aiLaws: '', elapsed })
    } else {
      const citations = (data?.citations ?? []) as { title: string; sections: string[] }[]
      const aiLaws = citations.map(ci => `${ci.title} [${(ci.sections ?? []).join(', ')}]`).join(' | ')
      console.log(`✅ ${elapsed}s | ${citations.length} citations`)
      results.push({ ...c, status: 'OK', aiLaws, citationCount: citations.length, elapsed })
    }

    // Cleanup
    await supabase.from('conversations').delete().eq('id', conv.id)
  } catch (err) {
    console.log(`❌ Exception`)
    results.push({ ...c, status: 'EXCEPTION', aiLaws: '' })
  }
}

// Report
console.log('\n' + '='.repeat(80))
console.log('LEGAL AI EVAL — Excel Test Cases v1.0')
console.log('='.repeat(80))

const ok = results.filter(r => r.status === 'OK').length
const fail = results.filter(r => r.status !== 'OK').length
console.log(`\nTotal: ${results.length} | OK: ${ok} | Errors: ${fail}\n`)

console.log('ID | Diff | Category | Query | Expected | AI Cited')
console.log('-'.repeat(80))
for (const r of results) {
  const icon = r.status === 'OK' ? '✅' : '❌'
  console.log(`${icon} ${r.id} | ${r.difficulty} | ${r.category}`)
  console.log(`  Q: ${r.query.substring(0, 60)}`)
  console.log(`  Expected: ${r.expectedLaws}`)
  console.log(`  AI: ${r.aiLaws || '(none)'}`)
  console.log()
}

// Save report
const report = results.map(r => `[${r.status}] #${r.id} (${r.difficulty}) ${r.category}\n  Q: ${r.query}\n  Expected: ${r.expectedLaws}\n  AI: ${r.aiLaws || '(none)'}\n  Time: ${r.elapsed}s`).join('\n\n')
await Bun.write('./scripts/eval-xlsx-report.txt', `LEGAL AI EVAL — ${new Date().toISOString()}\nOK: ${ok}/${results.length}\n${'='.repeat(60)}\n\n${report}`)
console.log('📄 Report saved to scripts/eval-xlsx-report.txt')
