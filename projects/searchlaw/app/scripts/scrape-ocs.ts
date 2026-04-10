import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const OCS_API = 'https://www.ocs.go.th/searchlaw/indexs/list_table_search'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const PER_PAGE = 100
const DELAY_MS = 500 // polite delay between requests

interface OCSLaw {
  lawCode: string
  lawNameTh: string
  lawNameEn: string | false
  contentlaw: string
  encTimelineID: string
  year: number
  publishDate: string
  fileUUID: string
  state: string
  childrens: string | object
  num: number
}

interface OCSResponse {
  meta: { page: number; perpage: number; total: number; pages: number }
  data: OCSLaw[]
}

async function fetchPage(page: number): Promise<OCSResponse> {
  const res = await fetch(OCS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pagination: { page, perpage: PER_PAGE },
      query: { tab_type: 'law1' },
    }),
  })
  if (!res.ok) throw new Error(`OCS API error: ${res.status}`)
  return res.json()
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log('🔍 Fetching page 1 to get total...')
  const first = await fetchPage(1)
  const totalPages = first.meta.pages
  const totalLaws = first.meta.total
  console.log(`📊 Total: ${totalLaws} laws, ${totalPages} pages\n`)

  let allLaws: OCSLaw[] = [...first.data]
  let inserted = 0
  let skipped = 0

  // Fetch remaining pages
  for (let page = 2; page <= totalPages; page++) {
    process.stdout.write(`⏳ Fetching page ${page}/${totalPages}...`)
    try {
      const res = await fetchPage(page)
      allLaws.push(...res.data)
      console.log(` ✅ ${res.data.length} laws`)
    } catch (err) {
      console.log(` ❌ Error: ${err}`)
      // Retry once
      await sleep(2000)
      try {
        const res = await fetchPage(page)
        allLaws.push(...res.data)
        console.log(` ✅ (retry) ${res.data.length} laws`)
      } catch {
        console.log(` ❌ Skipped page ${page}`)
      }
    }
    await sleep(DELAY_MS)
  }

  // Deduplicate by lawCode (keep last occurrence)
  const deduped = new Map<string, OCSLaw>()
  for (const law of allLaws) {
    deduped.set(law.lawCode, law)
  }
  const uniqueLaws = [...deduped.values()]
  console.log(`\n📥 Fetched ${allLaws.length} laws, ${uniqueLaws.length} unique. Inserting into Supabase...\n`)

  // Insert in batches of 50
  const BATCH_SIZE = 50
  for (let i = 0; i < uniqueLaws.length; i += BATCH_SIZE) {
    const batch = uniqueLaws.slice(i, i + BATCH_SIZE)
    const rows = batch.map((law) => ({
      law_code: law.lawCode,
      title: law.lawNameTh,
      title_en: law.lawNameEn || null,
      summary: law.contentlaw || null,
      source: 'ocs.go.th',
      source_url: law.encTimelineID
        ? `https://searchlaw.ocs.go.th/search-law-detail/${law.encTimelineID}`
        : null,
      pdf_url: law.fileUUID || null,
      publish_date: law.publishDate || null,
      status: law.state === '01' ? 'active' : law.state === '02' ? 'pending' : 'repealed',
      metadata: {
        year: law.year,
        childrens: law.childrens || null,
        num: law.num,
      },
    }))

    const { error } = await supabase.from('laws').upsert(rows, { onConflict: 'law_code' })

    if (error) {
      console.log(`  ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`)
      skipped += batch.length
    } else {
      inserted += batch.length
      process.stdout.write(`  ✅ ${inserted}/${uniqueLaws.length}\r`)
    }
  }

  console.log(`\n\n🎉 Done!`)
  console.log(`  Inserted/updated: ${inserted}`)
  console.log(`  Skipped (errors): ${skipped}`)

  // Verify
  const { count } = await supabase.from('laws').select('*', { count: 'exact', head: true })
  console.log(`  Total in DB: ${count}`)
}

main().catch(console.error)
