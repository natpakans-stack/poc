import { supabase } from './supabase'

// ============ System Stats ============
export async function getSystemStats() {
  const { data, error } = await supabase
    .from('system_stats')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data
}

// ============ Example Questions ============
export async function getExampleQuestions() {
  const { data, error } = await supabase
    .from('example_questions')
    .select('question')
    .eq('active', true)
    .order('sort_order')
  if (error) throw error
  return data.map((q) => q.question)
}

// ============ Data Sources ============
export async function getDataSources() {
  const { data, error } = await supabase
    .from('data_sources')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data
}

// ============ Releases ============
export async function getReleases() {
  const { data, error } = await supabase
    .from('releases')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getLatestRelease() {
  const { data, error } = await supabase
    .from('releases')
    .select('*')
    .eq('is_latest', true)
    .single()
  if (error) throw error
  return data
}

// ============ Laws ============
export async function getLaws() {
  const { data, error } = await supabase
    .from('laws')
    .select('id, title, source')
    .order('created_at')
  if (error) throw error
  return data
}

export async function getLawWithSections(lawId: string) {
  const [lawRes, sectionsRes] = await Promise.all([
    supabase.from('laws').select('*').eq('id', lawId).single(),
    supabase.from('law_sections').select('*').eq('law_id', lawId).order('sort_order'),
  ])
  if (lawRes.error) throw lawRes.error
  if (sectionsRes.error) throw sectionsRes.error
  return { ...lawRes.data, sections: sectionsRes.data }
}

// ============ Conversations ============
export async function getConversations() {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, description, created_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createConversation(title: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: user.id, title })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateConversationTitle(id: string, title: string, description?: string) {
  const update: { title: string; description?: string } = { title }
  if (description) update.description = description
  const { error } = await supabase
    .from('conversations')
    .update(update)
    .eq('id', id)
  if (error) throw error
}

export async function deleteConversation(id: string) {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ============ Messages ============
export async function getMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at')
  if (error) throw error
  return data
}

export async function createMessage(conversationId: string, role: 'user' | 'ai', content: string, extra?: {
  citations?: unknown[]
  court_decisions?: unknown[]
  summary?: string[]
}) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      citations: extra?.citations ?? [],
      court_decisions: extra?.court_decisions ?? [],
      summary: extra?.summary ?? [],
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ============ AI Chat (Edge Function) ============
export async function sendChatToAI(conversationId: string, message: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await supabase.functions.invoke('chat', {
    body: { conversationId, message },
  })

  if (res.error) throw res.error
  return res.data as { id: string; role: 'ai'; content: string; citations?: unknown[]; court_decisions?: unknown[]; summary?: string[]; follow_up_questions?: string[] }
}
