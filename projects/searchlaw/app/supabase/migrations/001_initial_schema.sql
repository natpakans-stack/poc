-- =============================================
-- Legal AI — Initial Schema
-- =============================================

-- 1. Conversations (chat sessions)
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'แชทใหม่',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Messages (chat messages within a conversation)
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'ai')),
  content text not null,
  citations jsonb default '[]',
  court_decisions jsonb default '[]',
  summary jsonb default '[]',
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_conversations_user_id on conversations(user_id);
create index idx_conversations_updated_at on conversations(updated_at desc);
create index idx_messages_conversation_id on messages(conversation_id);
create index idx_messages_created_at on messages(created_at);

-- Auto-update updated_at on conversations
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger conversations_updated_at
  before update on conversations
  for each row execute function update_updated_at();

-- =============================================
-- Row Level Security (RLS)
-- =============================================

alter table conversations enable row level security;
alter table messages enable row level security;

-- Users can only access their own conversations
create policy "Users can view own conversations"
  on conversations for select
  using (auth.uid() = user_id);

create policy "Users can create own conversations"
  on conversations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own conversations"
  on conversations for update
  using (auth.uid() = user_id);

create policy "Users can delete own conversations"
  on conversations for delete
  using (auth.uid() = user_id);

-- Users can only access messages in their own conversations
create policy "Users can view own messages"
  on messages for select
  using (
    exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
    )
  );

create policy "Users can create messages in own conversations"
  on messages for insert
  with check (
    exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
    )
  );
