-- =============================================
-- RUN THIS IN SUPABASE DASHBOARD > SQL EDITOR
-- =============================================

-- ============ MIGRATION 001 ============

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'แชทใหม่',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'ai')),
  content text not null,
  citations jsonb default '[]',
  court_decisions jsonb default '[]',
  summary jsonb default '[]',
  created_at timestamptz not null default now()
);

create index if not exists idx_conversations_user_id on conversations(user_id);
create index if not exists idx_conversations_updated_at on conversations(updated_at desc);
create index if not exists idx_messages_conversation_id on messages(conversation_id);
create index if not exists idx_messages_created_at on messages(created_at);

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists conversations_updated_at on conversations;
create trigger conversations_updated_at
  before update on conversations
  for each row execute function update_updated_at();

alter table conversations enable row level security;
alter table messages enable row level security;

drop policy if exists "Users can view own conversations" on conversations;
create policy "Users can view own conversations" on conversations for select using (auth.uid() = user_id);
drop policy if exists "Users can create own conversations" on conversations;
create policy "Users can create own conversations" on conversations for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own conversations" on conversations;
create policy "Users can update own conversations" on conversations for update using (auth.uid() = user_id);
drop policy if exists "Users can delete own conversations" on conversations;
create policy "Users can delete own conversations" on conversations for delete using (auth.uid() = user_id);

drop policy if exists "Users can view own messages" on messages;
create policy "Users can view own messages" on messages for select using (
  exists (select 1 from conversations where conversations.id = messages.conversation_id and conversations.user_id = auth.uid())
);
drop policy if exists "Users can create messages in own conversations" on messages;
create policy "Users can create messages in own conversations" on messages for insert with check (
  exists (select 1 from conversations where conversations.id = messages.conversation_id and conversations.user_id = auth.uid())
);

-- ============ MIGRATION 002 ============

create table if not exists laws (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists law_sections (
  id uuid primary key default gen_random_uuid(),
  law_id uuid not null references laws(id) on delete cascade,
  number text not null,
  title text not null,
  content text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists releases (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  date text not null,
  is_latest boolean not null default false,
  items jsonb not null default '[]',
  stats text,
  created_at timestamptz not null default now()
);

create table if not exists data_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  url text,
  status text not null check (status in ('active', 'planned')) default 'planned',
  badges jsonb not null default '[]',
  icon_color text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists system_stats (
  id uuid primary key default gen_random_uuid(),
  stat_key text not null unique,
  value text not null,
  label text not null,
  trend text,
  has_trend boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists example_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_law_sections_law_id on law_sections(law_id);
create index if not exists idx_law_sections_sort on law_sections(law_id, sort_order);
create index if not exists idx_releases_is_latest on releases(is_latest) where is_latest = true;
create index if not exists idx_releases_created_at on releases(created_at desc);
create index if not exists idx_data_sources_status on data_sources(status);
create index if not exists idx_data_sources_sort on data_sources(sort_order);
create index if not exists idx_example_questions_active on example_questions(active) where active = true;

drop trigger if exists laws_updated_at on laws;
create trigger laws_updated_at
  before update on laws
  for each row execute function update_updated_at();

alter table laws enable row level security;
alter table law_sections enable row level security;
alter table releases enable row level security;
alter table data_sources enable row level security;
alter table system_stats enable row level security;
alter table example_questions enable row level security;

drop policy if exists "Public read laws" on laws;
create policy "Public read laws" on laws for select using (true);
drop policy if exists "Public read law_sections" on law_sections;
create policy "Public read law_sections" on law_sections for select using (true);
drop policy if exists "Public read releases" on releases;
create policy "Public read releases" on releases for select using (true);
drop policy if exists "Public read data_sources" on data_sources;
create policy "Public read data_sources" on data_sources for select using (true);
drop policy if exists "Public read system_stats" on system_stats;
create policy "Public read system_stats" on system_stats for select using (true);
drop policy if exists "Public read example_questions" on example_questions;
create policy "Public read example_questions" on example_questions for select using (active = true);

-- ============ SEED DATA ============

insert into system_stats (stat_key, value, label, trend, has_trend, sort_order) values
  ('total_laws', '245', 'ฉบับกฎหมาย', '+12 ฉบับใหม่', true, 1),
  ('total_sections', '12,400', 'มาตรา', '+840 มาตรา', true, 2),
  ('total_decisions', '3,200', 'คำพิพากษาศาลฎีกา', '+1,200 คำพิพากษา', true, 3),
  ('total_sources', '5', 'แหล่งข้อมูล', 'ทั้งหมดพร้อมใช้', false, 4)
on conflict (stat_key) do nothing;

insert into example_questions (question, sort_order) values
  ('จะเปิดซาวน่าในโรงแรม ต้องขอใบอนุญาตอะไรบ้าง?', 1),
  ('ใบอนุญาตขายแอลกอฮอล์ในโรงแรม', 2),
  ('กฎหมายคุ้มครองผู้บริโภค e-commerce', 3),
  ('ภาษีที่ดินและสิ่งปลูกสร้าง สำหรับคอนโด', 4),
  ('สัญญาเช่าที่ดิน 30 ปี ทำยังไง?', 5),
  ('เลิกจ้างพนักงาน ต้องจ่ายชดเชยเท่าไร?', 6);

insert into data_sources (name, description, url, status, badges, icon_color, sort_order) values
  ('สำนักงานคณะกรรมการกฤษฎีกา', 'ocs.go.th — พ.ร.บ. / พ.ร.ก. / กฎกระทรวง / รัฐธรรมนูญ / ประมวลกฎหมาย', 'ocs.go.th', 'active', '["พ.ร.บ. 180 ฉบับ", "พ.ร.ก. 25 ฉบับ", "กฎกระทรวง 40 ฉบับ"]', 'brand', 1),
  ('ศาลฎีกา', 'deka.supremecourt.or.th — คำพิพากษาศาลฎีกา ทุกแผนก', 'deka.supremecourt.or.th', 'active', '["แพ่ง 1,400 คดี", "อาญา 980 คดี", "แรงงาน 520 คดี"]', 'purple', 2),
  ('ราชกิจจานุเบกษา', 'ratchakitcha.soc.go.th — ประกาศ คำสั่ง ระเบียบ', 'ratchakitcha.soc.go.th', 'active', '["ประกาศ 300 ฉบับ"]', 'blue', 3),
  ('คณะกรรมการกฤษฎีกา (ความเห็น)', 'ความเห็นคณะกรรมการกฤษฎีกา — บันทึกตีความกฎหมาย', null, 'planned', '["เร็วๆ นี้"]', 'amber', 4),
  ('วิทยานิพนธ์ / บทความวิชาการ', 'บทความวิชาการด้านกฎหมายจากมหาวิทยาลัยชั้นนำ', null, 'planned', '["เร็วๆ นี้"]', 'rose', 5);

insert into releases (version, date, is_latest, items, stats) values
  ('v1.3', '20 มีนาคม 2569', true,
   '[{"tag":"Added","text":"เพิ่ม พ.ร.บ. การสาธารณสุข พ.ศ. 2535 พร้อมกฎกระทรวงที่เกี่ยวข้อง 12 ฉบับ"},{"tag":"Added","text":"เพิ่ม คำพิพากษาศาลฎีกา แผนกคดีแรงงาน ปี 2566 จำนวน 520 คำพิพากษา"},{"tag":"Improved","text":"ปรับปรุง cross-reference ระหว่าง พ.ร.บ. และกฎกระทรวง — ลิงก์อ้างอิงแม่นยำขึ้น"}]',
   'รวม: 245 ฉบับ · 12,400 มาตรา · 3,200 คำพิพากษา'),
  ('v1.2', '5 มีนาคม 2569', false,
   '[{"tag":"Added","text":"เพิ่มราชกิจจานุเบกษา 300 ฉบับ"},{"tag":"Added","text":"เพิ่มคำพิพากษาศาลฎีกา แผนกคดีอาญา ปี 2565-2566"},{"tag":"Improved","text":"ปรับปรุงระบบค้นหาให้รองรับ synonym"},{"tag":"Fixed","text":"แก้ไขลิงก์อ้างอิงมาตราที่เชื่อมผิดฉบับ"}]',
   null),
  ('v1.1', '15 กุมภาพันธ์ 2569', false,
   '[{"tag":"Added","text":"เพิ่มคำพิพากษาศาลฎีกา แผนกคดีแพ่ง ปี 2565-2566 จำนวน 1,400 คำพิพากษา"},{"tag":"Improved","text":"ปรับปรุง AI ให้ตอบคำถามเกี่ยวกับประมวลกฎหมายได้แม่นยำขึ้น"}]',
   null),
  ('v1.0', '1 กุมภาพันธ์ 2569', false,
   '[{"tag":"Added","text":"เปิดตัวระบบ Legal AI พร้อม พ.ร.บ. 180 ฉบับจาก ocs.go.th"},{"tag":"Added","text":"ระบบแชท AI ถาม-ตอบกฎหมายภาษาไทย"},{"tag":"Added","text":"Law Viewer สำหรับอ่านเนื้อกฎหมายฉบับเต็ม"}]',
   null)
on conflict (version) do nothing;

insert into laws (id, title, source) values
  ('00000000-0000-0000-0000-000000000001', 'พระราชบัญญัติโรงแรม พ.ศ. 2547', 'https://ocs.go.th')
on conflict (id) do nothing;

insert into law_sections (law_id, number, title, content, sort_order) values
  ('00000000-0000-0000-0000-000000000001', 'มาตรา 3', 'บทนิยาม',
   E'ในพระราชบัญญัตินี้\n\n"โรงแรม" หมายความว่า สถานที่พักที่จัดตั้งขึ้นโดยมีวัตถุประสงค์ในทางธุรกิจเพื่อให้บริการที่พักชั่วคราวสำหรับคนเดินทางหรือบุคคลอื่นใดโดยมีค่าตอบแทน', 1),
  ('00000000-0000-0000-0000-000000000001', 'มาตรา 4', 'การยกเว้น',
   E'พระราชบัญญัตินี้มิให้ใช้บังคับแก่\n\n(1) สถานที่พักที่จัดตั้งขึ้นเพื่อให้บริการที่พักชั่วคราวซึ่งดำเนินการโดยส่วนราชการ รัฐวิสาหกิจ หรือหน่วยงานอื่นของรัฐ\n\n(2) สถานที่พักที่จัดตั้งขึ้นโดยมีวัตถุประสงค์เพื่อการกุศลหรือการศึกษา โดยมิได้แสวงหากำไร\n\n(3) สถานที่พักอื่นตามที่กำหนดในกฎกระทรวง', 2),
  ('00000000-0000-0000-0000-000000000001', 'มาตรา 5', 'ประเภทของโรงแรม',
   E'โรงแรมแบ่งออกเป็นประเภทต่าง ๆ ตามที่กำหนดในกฎกระทรวง\n\nการกำหนดประเภทของโรงแรมตามวรรคหนึ่ง ให้คำนึงถึงลักษณะของอาคาร สิ่งอำนวยความสะดวก การให้บริการ และการบริหารจัดการของโรงแรม', 3),
  ('00000000-0000-0000-0000-000000000001', 'มาตรา 15', 'การขอใบอนุญาต',
   E'ผู้ใดประสงค์จะประกอบธุรกิจโรงแรม ให้ยื่นคำขอรับใบอนุญาตต่อนายทะเบียน\n\nใบอนุญาตประกอบธุรกิจโรงแรมให้มีอายุห้าปีนับแต่วันที่ออกใบอนุญาต', 4),
  ('00000000-0000-0000-0000-000000000001', 'มาตรา 16', 'คุณสมบัติผู้ขอใบอนุญาต',
   E'ผู้ขอรับใบอนุญาตประกอบธุรกิจโรงแรมต้องมีคุณสมบัติและไม่มีลักษณะต้องห้าม ดังต่อไปนี้\n\n(1) เป็นบุคคลธรรมดาซึ่งมีสัญชาติไทย\n(2) มีอายุไม่ต่ำกว่ายี่สิบปีบริบูรณ์\n(3) ไม่เป็นบุคคลล้มละลาย', 5);
