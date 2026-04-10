import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const BATCH_SIZE = 100 // OpenAI supports up to 2048 per batch
const DELAY_MS = 200

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
  })
  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.data.map((d: { embedding: number[] }) => d.embedding)
}

async function main() {
  // Get sections without embeddings
  let totalProcessed = 0
  let totalEmbedded = 0
  let offset = 0

  while (true) {
    const { data: sections, error } = await supabase
      .from('law_sections')
      .select('id, number, title, content')
      .is('embedding', null)
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) { console.error('DB error:', error.message); break }
    if (!sections || sections.length === 0) { console.log('No more sections without embeddings'); break }

    // Prepare texts for embedding — truncate to ~2000 chars (~500 tokens) to be safe
    const texts = sections.map(s => {
      const text = `${s.number} ${s.title !== s.number ? s.title : ''} ${s.content ?? ''}`.trim()
      return text.substring(0, 2000)
    })

    try {
      const embeddings = await getEmbeddings(texts)

      // Update each section with its embedding
      for (let i = 0; i < sections.length; i++) {
        const { error: updateError } = await supabase
          .from('law_sections')
          .update({ embedding: embeddings[i] as any })
          .eq('id', sections[i].id)

        if (updateError) {
          console.error(`Update error for ${sections[i].id}:`, updateError.message)
        } else {
          totalEmbedded++
        }
      }

      totalProcessed += sections.length
      process.stdout.write(`\r✅ ${totalProcessed} processed, ${totalEmbedded} embedded`)

      if (totalProcessed % 1000 === 0) {
        console.log(`\n📊 Progress: ${totalProcessed} / ~84K`)
      }
    } catch (err: any) {
      console.error(`\nEmbedding error at offset ${offset}:`, err.message)
      // Wait and retry
      await new Promise(r => setTimeout(r, 5000))
      continue // Don't increment offset, retry same batch
    }

    await new Promise(r => setTimeout(r, DELAY_MS))
    // Don't increment offset — query with `is null` will skip already embedded
  }

  console.log(`\n\n🎉 Done! Embedded ${totalEmbedded} sections`)

  // Verify
  const { count } = await supabase.from('law_sections').select('*', { count: 'exact', head: true }).not('embedding', 'is', null)
  console.log(`Total with embeddings: ${count}`)
}

main().catch(console.error)
