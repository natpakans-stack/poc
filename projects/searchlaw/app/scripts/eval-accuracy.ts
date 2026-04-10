/**
 * Legal AI Accuracy Evaluation
 * Run: bun scripts/eval-accuracy.ts
 *
 * Tests 20 cases against the Edge Function and compares
 * AI-cited laws vs expected laws from the evaluation set.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xqmdyjjatkpmjzlqpffr.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxbWR5amphdGtwbWp6bHFwZmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMzU4NjAsImV4cCI6MjA4OTkxMTg2MH0.aUor2u1zo6Q7uzue17g8_UwW5EXYTpM834H7Wk4XQxs'

const EMAIL = 'natpakan.s@real-factory.co'
const PASSWORD = 'YArGuvEjn6KuHvZh'

const cases = [
  {"id":"case_001","facts":"ลูกค้าโอนเงินซื้อ iPhone 25,000 บาทผ่าน Instagram ร้านค้าไม่ส่งของและบล็อกลูกค้า พร้อมนำข้อมูลเบอร์โทรลูกค้าไปขายให้บริษัทโฆษณา และใช้รูปสินค้าจากเว็บ Apple โดยไม่ได้รับอนุญาต","issues":["ฉ้อโกง","ผิดสัญญา","ละเมิดข้อมูลส่วนบุคคล","ละเมิดลิขสิทธิ์"],"laws":["อาญา ม.341","แพ่ง (ซื้อขาย)","PDPA ม.19","PDPA ม.27","พ.ร.บ.ลิขสิทธิ์"]},
  {"id":"case_002","facts":"พนักงานฝ่ายขายลาออกและนำฐานข้อมูลลูกค้า (รวม pricing และ deal history) ไปใช้กับบริษัทคู่แข่ง ทั้งที่มี NDA","issues":["ความลับทางการค้า","ผิดสัญญา"],"laws":["พ.ร.บ.ความลับทางการค้า","แพ่ง (สัญญา)"]},
  {"id":"case_003","facts":"ผู้ใช้โพสต์ใน Facebook ว่าร้านอาหารใช้วัตถุดิบเน่าโดยไม่มีหลักฐาน ทำให้ร้านเสียลูกค้า","issues":["หมิ่นประมาทโดยการโฆษณา"],"laws":["อาญา ม.326","อาญา ม.328","พ.ร.บ.คอม ม.14"]},
  {"id":"case_004","facts":"บริษัทใช้ AI generate artwork ที่มีลักษณะเหมือนศิลปินชื่อดังและนำไปขายเชิงพาณิชย์","issues":["ละเมิดลิขสิทธิ์","ความรับผิด AI"],"laws":["พ.ร.บ.ลิขสิทธิ์","แพ่ง (ละเมิด)"]},
  {"id":"case_005","facts":"Fintech ถูกแฮ็ก ข้อมูลลูกค้า (เลขบัตร/เบอร์โทร) หลุด แต่บริษัทไม่แจ้งลูกค้า","issues":["Data breach","ไม่แจ้งเหตุ"],"laws":["PDPA ม.37"]},
  {"id":"case_006","facts":"ฟรีแลนซ์รับทำเว็บไซต์ ตกลงส่ง 30 วัน แต่ส่งจริง 90 วัน ทำให้ลูกค้าเสียโอกาสทางธุรกิจ","issues":["ผิดสัญญา","ค่าเสียหาย"],"laws":["แพ่ง (จ้างทำของ)"]},
  {"id":"case_007","facts":"Marketplace มีผู้ขายขายยาผิดกฎหมาย และแพลตฟอร์มไม่ลบแม้มีแจ้งหลายครั้ง","issues":["ความรับผิดตัวกลาง"],"laws":["พ.ร.บ.คอม ม.15"]},
  {"id":"case_008","facts":"บริษัทเลิกจ้างพนักงานทันทีโดยไม่จ่ายค่าชดเชยและไม่แจ้งล่วงหน้า","issues":["เลิกจ้างไม่เป็นธรรม"],"laws":["กฎหมายแรงงาน"]},
  {"id":"case_009","facts":"โฆษณาผลิตภัณฑ์ว่าสามารถลดน้ำหนัก 10 กก. ใน 7 วันโดยไม่มีหลักฐาน","issues":["โฆษณาเกินจริง"],"laws":["พ.ร.บ.คุ้มครองผู้บริโภค"]},
  {"id":"case_010","facts":"แฮ็กเกอร์เข้าระบบบริษัทและขโมยข้อมูลลูกค้า","issues":["เข้าถึงระบบโดยมิชอบ"],"laws":["พ.ร.บ.คอม ม.5","พ.ร.บ.คอม ม.6","พ.ร.บ.คอม ม.7"]},
  {"id":"case_011","facts":"บริษัทส่ง email marketing โดยไม่ขอ consent และไม่มี opt-out","issues":["PDPA","spam"],"laws":["PDPA ม.19","พ.ร.บ.คอม"]},
  {"id":"case_012","facts":"ร้านค้าใช้รูป influencer ในโฆษณาโดยไม่ได้รับอนุญาต","issues":["สิทธิในภาพ","ลิขสิทธิ์"],"laws":["แพ่ง","พ.ร.บ.ลิขสิทธิ์"]},
  {"id":"case_013","facts":"ผู้เช่าไม่จ่ายค่าเช่า 3 เดือนและไม่ยอมย้ายออก","issues":["ผิดสัญญาเช่า"],"laws":["แพ่ง"]},
  {"id":"case_014","facts":"ธนาคารหักเงินลูกค้าเกินจริงจากระบบผิดพลาด","issues":["ลาภมิควรได้","ผิดสัญญา"],"laws":["แพ่ง"]},
  {"id":"case_015","facts":"แอปเก็บ location user ตลอดเวลาโดยไม่แจ้งใน privacy policy","issues":["PDPA","ละเมิดความเป็นส่วนตัว"],"laws":["PDPA ม.19"]},
  {"id":"case_016","facts":"บริษัท copy UI/UX ของ competitor อย่างใกล้เคียงจนทำให้ผู้ใช้สับสน","issues":["ทรัพย์สินทางปัญญา","แข่งขันไม่เป็นธรรม"],"laws":["พ.ร.บ.ลิขสิทธิ์","แพ่ง"]},
  {"id":"case_017","facts":"พนักงานขโมยสินค้าในคลังบริษัทไปขาย","issues":["ลักทรัพย์"],"laws":["อาญา"]},
  {"id":"case_018","facts":"ผู้ใช้สร้าง deepfake CEO เพื่อหลอกให้พนักงานโอนเงิน","issues":["ฉ้อโกง","ข้อมูลเท็จ"],"laws":["อาญา ม.341","พ.ร.บ.คอม"]},
  {"id":"case_019","facts":"ผู้ใช้ scrape ข้อมูลจากเว็บ competitor รวมถึงข้อมูลลูกค้า","issues":["ละเมิดข้อมูล","PDPA","สัญญา"],"laws":["PDPA","แพ่ง"]},
  {"id":"case_020","facts":"บริษัทเขียน Terms ว่าไม่รับผิดทุกกรณีแม้ระบบล่ม และลูกค้าเสียหายจากระบบล่ม","issues":["ข้อสัญญาไม่เป็นธรรม"],"laws":["พ.ร.บ.คุ้มครองผู้บริโภค","พ.ร.บ.ข้อสัญญาที่ไม่เป็นธรรม"]},
]

// Normalize law names for fuzzy matching
function normalizeLaw(s: string): string {
  return s
    .replace(/พระราชบัญญัติ/g, 'พ.ร.บ.')
    .replace(/ประมวลกฎหมาย/g, '')
    .replace(/แพ่งและพาณิชย์/g, 'แพ่ง')
    .replace(/คุ้มครองแรงงาน/g, 'แรงงาน')
    .replace(/ว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์.*/g, 'คอม')
    .replace(/คุ้มครองข้อมูลส่วนบุคคล/g, 'PDPA')
    .replace(/พ\.ศ\.\s*\d+/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase()
}

// Check if AI-cited law matches an expected law
function lawMatches(aiLaw: string, expectedLaw: string): boolean {
  const a = normalizeLaw(aiLaw)
  const e = normalizeLaw(expectedLaw)

  // Direct inclusion
  if (a.includes(e) || e.includes(a)) return true

  // Keyword matching
  const keywords: Record<string, string[]> = {
    'อาญา': ['อาญา'],
    'แพ่ง': ['แพ่ง', 'พาณิชย์'],
    'pdpa': ['pdpa', 'ข้อมูลส่วนบุคคล'],
    'คอม': ['คอม', 'คอมพิวเตอร์'],
    'แรงงาน': ['แรงงาน', 'คุ้มครองแรงงาน'],
    'ลิขสิทธิ์': ['ลิขสิทธิ์'],
    'คุ้มครองผู้บริโภค': ['ผู้บริโภค'],
    'ข้อสัญญา': ['ข้อสัญญา', 'ไม่เป็นธรรม'],
    'ความลับทางการค้า': ['ความลับ', 'การค้า'],
  }

  for (const [, kws] of Object.entries(keywords)) {
    const eHas = kws.some(k => e.includes(k))
    const aHas = kws.some(k => a.includes(k))
    if (eHas && aHas) return true
  }

  return false
}

// Check if section number matches
function sectionMatches(aiSections: string[], expectedLaw: string): boolean {
  const mMatch = expectedLaw.match(/ม\.(\d+)/)
  if (!mMatch) return true // No specific section expected
  const expectedNum = mMatch[1]
  return aiSections.some(s => {
    const num = s.replace(/[^\d]/g, '')
    return num === expectedNum
  })
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  // Login
  const { error: authError } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (authError) { console.error('Auth failed:', authError.message); return }
  console.log('✅ Logged in\n')

  const results: {
    id: string
    expectedLaws: string[]
    aiLaws: string[]
    aiSections: Record<string, string[]>
    lawMatch: boolean
    sectionMatch: boolean
    details: string
  }[] = []

  // Process cases sequentially (Edge Function has rate limits)
  for (const c of cases) {
    process.stdout.write(`[${c.id}] Testing... `)

    try {
      // Create conversation
      const { data: { user } } = await supabase.auth.getUser()
      const { data: conv } = await supabase.from('conversations')
        .insert({ user_id: user!.id, title: `eval-${c.id}` })
        .select().single()

      if (!conv) { console.log('❌ Failed to create conversation'); continue }

      // Save user message
      await supabase.from('messages').insert({
        conversation_id: conv.id, role: 'user', content: c.facts,
        citations: [], court_decisions: [], summary: [],
      })

      // Call Edge Function
      const start = Date.now()
      const { data, error } = await supabase.functions.invoke('chat', {
        body: { conversationId: conv.id, message: c.facts },
      })
      const elapsed = ((Date.now() - start) / 1000).toFixed(1)

      if (error) {
        console.log(`❌ Error: ${error.message} (${elapsed}s)`)
        results.push({ id: c.id, expectedLaws: c.laws, aiLaws: [], aiSections: {}, lawMatch: false, sectionMatch: false, details: `Error: ${error.message}` })
        continue
      }

      // Extract AI citations
      const citations = (data?.citations ?? []) as { title: string; sections: string[] }[]
      const aiLaws = citations.map(ci => ci.title)
      const aiSections: Record<string, string[]> = {}
      for (const ci of citations) {
        aiSections[ci.title] = ci.sections ?? []
      }

      // Compare: law matching
      let lawHits = 0
      const lawDetails: string[] = []
      for (const expected of c.laws) {
        const found = aiLaws.some(ai => lawMatches(ai, expected))
        if (found) {
          lawHits++
          // Check section
          const matchedAi = aiLaws.find(ai => lawMatches(ai, expected))
          const secOk = matchedAi ? sectionMatches(aiSections[matchedAi] ?? [], expected) : false
          lawDetails.push(`  ✅ ${expected}${secOk ? '' : ' (มาตราไม่ตรง)'}`)
        } else {
          lawDetails.push(`  ❌ ${expected} — ไม่พบ`)
        }
      }

      // Extra laws AI cited but not expected
      const extraLaws = aiLaws.filter(ai => !c.laws.some(exp => lawMatches(ai, exp)))
      for (const extra of extraLaws) {
        lawDetails.push(`  ➕ ${extra} [${(aiSections[extra] ?? []).join(', ')}] — เพิ่มเติม`)
      }

      const lawMatch = lawHits === c.laws.length
      const sectionOk = c.laws.every(exp => {
        const matchedAi = aiLaws.find(ai => lawMatches(ai, exp))
        return matchedAi ? sectionMatches(aiSections[matchedAi] ?? [], exp) : false
      })

      const score = `${lawHits}/${c.laws.length}`
      const icon = lawMatch ? '✅' : lawHits > 0 ? '⚠️' : '❌'
      console.log(`${icon} Laws: ${score} (${elapsed}s)`)

      results.push({
        id: c.id,
        expectedLaws: c.laws,
        aiLaws,
        aiSections,
        lawMatch,
        sectionMatch: sectionOk,
        details: lawDetails.join('\n'),
      })

      // Cleanup: delete eval conversation
      await supabase.from('conversations').delete().eq('id', conv.id)

    } catch (err) {
      console.log(`❌ Exception: ${err}`)
      results.push({ id: c.id, expectedLaws: c.laws, aiLaws: [], aiSections: {}, lawMatch: false, sectionMatch: false, details: `Exception: ${err}` })
    }
  }

  // ===== REPORT =====
  console.log('\n' + '='.repeat(60))
  console.log('LEGAL AI ACCURACY REPORT — v26')
  console.log('='.repeat(60))

  const totalCases = results.length
  const lawCorrect = results.filter(r => r.lawMatch).length
  const sectionCorrect = results.filter(r => r.sectionMatch).length
  const partialLaw = results.filter(r => !r.lawMatch && r.aiLaws.length > 0).length

  console.log(`\nCases: ${totalCases}`)
  console.log(`Law accuracy (all expected found): ${lawCorrect}/${totalCases} (${(lawCorrect/totalCases*100).toFixed(0)}%)`)
  console.log(`Section accuracy: ${sectionCorrect}/${totalCases} (${(sectionCorrect/totalCases*100).toFixed(0)}%)`)
  console.log(`Partial match: ${partialLaw}/${totalCases}`)
  console.log(`Complete miss: ${totalCases - lawCorrect - partialLaw}/${totalCases}`)

  console.log('\n--- DETAILS ---\n')
  for (const r of results) {
    const icon = r.lawMatch ? '✅' : r.aiLaws.length > 0 ? '⚠️' : '❌'
    console.log(`${icon} ${r.id}`)
    console.log(`  Expected: ${r.expectedLaws.join(', ')}`)
    console.log(`  AI cited: ${r.aiLaws.join(', ') || '(none)'}`)
    console.log(r.details)
    console.log()
  }

  // Save report
  const reportPath = './scripts/eval-report.txt'
  const report = results.map(r => {
    const icon = r.lawMatch ? 'PASS' : r.aiLaws.length > 0 ? 'PARTIAL' : 'FAIL'
    return `[${icon}] ${r.id}\n  Expected: ${r.expectedLaws.join(', ')}\n  AI: ${r.aiLaws.join(', ') || '(none)'}\n${r.details}`
  }).join('\n\n')

  const summary = `LEGAL AI ACCURACY REPORT — v26 — ${new Date().toISOString()}\n${'='.repeat(60)}\nCases: ${totalCases}\nLaw accuracy: ${lawCorrect}/${totalCases} (${(lawCorrect/totalCases*100).toFixed(0)}%)\nSection accuracy: ${sectionCorrect}/${totalCases} (${(sectionCorrect/totalCases*100).toFixed(0)}%)\nPartial: ${partialLaw} | Miss: ${totalCases - lawCorrect - partialLaw}\n${'='.repeat(60)}\n\n${report}`

  await Bun.write(reportPath, summary)
  console.log(`\n📄 Report saved to ${reportPath}`)
}

main()
