/**
 * Migrate embeddings from Supabase to Qdrant Cloud
 * Usage: QDRANT_URL="https://xxx.cloud.qdrant.io:6333" QDRANT_API_KEY="xxx" bun scripts/migrate-to-qdrant.ts
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xqmdyjjatkpmjzlqpffr.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxbWR5amphdGtwbWp6bHFwZmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMzU4NjAsImV4cCI6MjA4OTkxMTg2MH0.aUor2u1zo6Q7uzue17g8_UwW5EXYTpM834H7Wk4XQxs'
const QDRANT_URL = process.env.QDRANT_URL
const QDRANT_API_KEY = process.env.QDRANT_API_KEY

if (!QDRANT_URL || !QDRANT_API_KEY) {
  console.error('❌ Set QDRANT_URL and QDRANT_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, ANON_KEY)
const COLLECTION = 'law_sections'

async function qdrant(method: string, path: string, body?: any) {
  const res = await fetch(`${QDRANT_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'api-key': QDRANT_API_KEY!,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Qdrant ${method} ${path}: ${res.status} ${text.substring(0, 200)}`)
  }
  return res.json()
}

async function main() {
  console.log('🚀 Migrating embeddings to Qdrant\n')

  // Step 1: Create collection
  console.log('=== Step 1: Create collection ===')
  try {
    await qdrant('DELETE', `/collections/${COLLECTION}`)
  } catch {}

  await qdrant('PUT', `/collections/${COLLECTION}`, {
    vectors: { size: 1536, distance: 'Cosine' },
    optimizers_config: { indexing_threshold: 10000 },
  })
  console.log('✅ Collection created\n')

  // Step 2: Get all section IDs from Supabase
  console.log('=== Step 2: Get section IDs ===')
  const allIds: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data } = await supabase.from('law_sections').select('id').order('id').range(offset, offset + 999)
    if (!data || data.length === 0) break
    allIds.push(...data.map(r => r.id))
    if (data.length < 1000) break
  }
  console.log(`  ${allIds.length} sections to migrate\n`)

  // Step 3: Fetch embeddings and upsert to Qdrant in batches
  console.log('=== Step 3: Migrate vectors ===')
  let migrated = 0
  let skipped = 0
  const BATCH = 20

  for (let i = 0; i < allIds.length; i += BATCH) {
    const batchIds = allIds.slice(i, i + BATCH)

    // Fetch from Supabase
    let data: any[] | null = null
    for (let retry = 0; retry < 5; retry++) {
      const res = await supabase.from('law_sections')
        .select('id, law_id, number, content, embedding')
        .in('id', batchIds)
      if (!res.error && res.data) { data = res.data; break }
      await new Promise(r => setTimeout(r, 2000 * (retry + 1)))
    }
    if (!data) { skipped += batchIds.length; continue }

    // Build Qdrant points
    const points: any[] = []
    for (const row of data) {
      if (!row.embedding) { skipped++; continue }
      const vector = typeof row.embedding === 'string'
        ? JSON.parse(row.embedding)
        : row.embedding

      points.push({
        id: row.id,
        vector,
        payload: {
          law_id: row.law_id,
          number: row.number,
          content: (row.content ?? '').substring(0, 500),
        },
      })
    }

    if (points.length > 0) {
      try {
        await qdrant('PUT', `/collections/${COLLECTION}/points`, { points })
        migrated += points.length
      } catch (e: any) {
        if (migrated < 100) console.log(`\n  ERR: ${e.message?.substring(0, 100)}`)
        skipped += points.length
      }
    }

    process.stdout.write(`  ${migrated} migrated, ${skipped} skipped (${Math.round((i + BATCH) / allIds.length * 100)}%)\r`)
  }
  console.log(`\n✅ ${migrated} vectors migrated, ${skipped} skipped\n`)

  // Step 4: Verify
  console.log('=== Step 4: Verify ===')
  const info = await qdrant('GET', `/collections/${COLLECTION}`)
  console.log(`  Collection: ${info.result.status}`)
  console.log(`  Points: ${info.result.points_count}`)
  console.log(`  Vectors: ${info.result.vectors_count}`)
  console.log(`  Indexed: ${info.result.indexed_vectors_count}`)

  console.log('\n🎉 Done!')
}

main().catch(e => { console.error('❌', e); process.exit(1) })
