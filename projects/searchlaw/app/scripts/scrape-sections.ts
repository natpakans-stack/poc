import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const OCS_SECTIONS_API = 'https://searchlaw.ocs.go.th/ocs-api/public/doc/getLawDoc'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractSectionName(content: string): string {
  // Try to extract "มาตรา X" from content
  const match = content.match(/มาตรา\s*[๐-๙\d]+/)
  if (match) return match[0]
  return ''
}

async function fetchSections(timelineId: string) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 23)
  const res = await fetch(OCS_SECTIONS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reqHeader: {
        reqId: String(Date.now()),
        reqChannel: 'WEB',
        reqDtm: now,
        reqBy: 'unknow',
        serviceName: 'getPublicLawDoc',
        uuid: crypto.randomUUID(),
        sessionId: crypto.randomUUID(),
      },
      reqBody: { isTransEng: false, timelineId },
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (data.respHeader?.errorCode !== 'SUCCESS') {
    throw new Error(data.respHeader?.errorDesc || 'API error')
  }
  return data.respBody
}

async function main() {
  // Get all laws with encTimelineID (stored in source_url)
  const { data: laws, error } = await supabase
    .from('laws')
    .select('id, title, source_url, metadata')
    .not('source_url', 'is', null)
    .order('created_at')

  if (error || !laws) {
    console.error('Error loading laws:', error)
    return
  }

  // Extract timelineId from source_url
  const lawsWithTimeline = laws
    .map(law => {
      // source_url format: https://searchlaw.ocs.go.th/search-law-detail/{id}
      // But the actual encTimelineID is in the scraped data
      const encId = (law.metadata as any)?.encTimelineID ?? law.source_url?.split('/').pop()
      return { ...law, encTimelineId: encId }
    })
    .filter(l => l.encTimelineId)

  console.log(`📊 ${lawsWithTimeline.length} laws with timeline IDs`)

  // Check how many already have sections
  const { count: existingSections } = await supabase
    .from('law_sections')
    .select('*', { count: 'exact', head: true })
  console.log(`📋 Existing sections in DB: ${existingSections}`)

  let processed = 0
  let success = 0
  let failed = 0
  let totalSections = 0

  for (const law of lawsWithTimeline) {
    processed++

    // Check if already has sections
    const { count } = await supabase
      .from('law_sections')
      .select('*', { count: 'exact', head: true })
      .eq('law_id', law.id)
    if ((count ?? 0) > 0) {
      process.stdout.write(`  [${processed}/${lawsWithTimeline.length}] ${law.title.substring(0, 40)}... already has ${count} sections, skipping\r`)
      success++
      continue
    }

    try {
      const body = await fetchSections(law.encTimelineId)
      const sections = body.lawSections ?? []

      if (sections.length === 0) {
        failed++
        continue
      }

      // Insert sections
      const rows = sections.map((s: any, i: number) => {
        const rawContent = s.sectionContent ?? ''
        const plainContent = stripHtml(rawContent)
        const sectionName = s.sectionLabel || s.sectionName || extractSectionName(plainContent) || `ส่วนที่ ${i + 1}`
        return {
          law_id: law.id,
          number: sectionName,
          title: sectionName,
          content: plainContent,
          sort_order: s.sectionSeq ?? i + 1,
        }
      })

      const { error: insertError } = await supabase.from('law_sections').insert(rows)
      if (insertError) {
        console.log(`\n  ❌ [${processed}] ${law.title.substring(0, 40)}: ${insertError.message}`)
        failed++
      } else {
        totalSections += rows.length
        success++
        process.stdout.write(`  ✅ [${processed}/${lawsWithTimeline.length}] +${rows.length} sections (total: ${totalSections})\r`)
      }
    } catch (err: any) {
      failed++
      if (processed % 50 === 0) {
        console.log(`\n  ❌ [${processed}] ${law.title.substring(0, 40)}: ${err.message}`)
      }
    }

    // Polite delay
    await sleep(300)

    // Progress every 100
    if (processed % 100 === 0) {
      console.log(`\n📊 Progress: ${processed}/${lawsWithTimeline.length} | success: ${success} | failed: ${failed} | sections: ${totalSections}`)
    }
  }

  console.log(`\n\n🎉 Done!`)
  console.log(`  Processed: ${processed}`)
  console.log(`  Success: ${success}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Total sections added: ${totalSections}`)

  const { count: finalCount } = await supabase.from('law_sections').select('*', { count: 'exact', head: true })
  console.log(`  Total sections in DB: ${finalCount}`)
}

main().catch(console.error)
