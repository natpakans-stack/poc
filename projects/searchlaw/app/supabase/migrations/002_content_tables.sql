-- =============================================
-- Legal AI — Content Tables
-- =============================================

-- 1. Laws (ฐานข้อมูลกฎหมาย)
create table laws (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Law Sections (มาตราในกฎหมาย)
create table law_sections (
  id uuid primary key default gen_random_uuid(),
  law_id uuid not null references laws(id) on delete cascade,
  number text not null,
  title text not null,
  content text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 3. Releases (ประวัติอัพเดท)
create table releases (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  date text not null,
  is_latest boolean not null default false,
  items jsonb not null default '[]',
  stats text,
  created_at timestamptz not null default now()
);

-- 4. Data Sources (แหล่งข้อมูล)
create table data_sources (
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

-- 5. System Stats (ตัวเลขสถิติบนหน้าแรก)
create table system_stats (
  id uuid primary key default gen_random_uuid(),
  stat_key text not null unique,
  value text not null,
  label text not null,
  trend text,
  has_trend boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

-- 6. Example Questions (คำถามตัวอย่าง typewriter)
create table example_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =============================================
-- Indexes
-- =============================================

create index idx_law_sections_law_id on law_sections(law_id);
create index idx_law_sections_sort on law_sections(law_id, sort_order);
create index idx_releases_is_latest on releases(is_latest) where is_latest = true;
create index idx_releases_created_at on releases(created_at desc);
create index idx_data_sources_status on data_sources(status);
create index idx_data_sources_sort on data_sources(sort_order);
create index idx_example_questions_active on example_questions(active) where active = true;

-- Auto-update updated_at on laws
create trigger laws_updated_at
  before update on laws
  for each row execute function update_updated_at();

-- =============================================
-- Row Level Security — Public read, no public write
-- =============================================

alter table laws enable row level security;
alter table law_sections enable row level security;
alter table releases enable row level security;
alter table data_sources enable row level security;
alter table system_stats enable row level security;
alter table example_questions enable row level security;

-- Public read policies (ทุกคนอ่านได้ เขียนผ่าน service_role key จาก backend เท่านั้น)
create policy "Public read laws" on laws for select using (true);
create policy "Public read law_sections" on law_sections for select using (true);
create policy "Public read releases" on releases for select using (true);
create policy "Public read data_sources" on data_sources for select using (true);
create policy "Public read system_stats" on system_stats for select using (true);
create policy "Public read example_questions" on example_questions for select using (active = true);

-- =============================================
-- Seed Data
-- =============================================

-- Stats
insert into system_stats (stat_key, value, label, trend, has_trend, sort_order) values
  ('total_laws', '245', 'ฉบับกฎหมาย', '+12 ฉบับใหม่', true, 1),
  ('total_sections', '12,400', 'มาตรา', '+840 มาตรา', true, 2),
  ('total_decisions', '3,200', 'คำพิพากษาศาลฎีกา', '+1,200 คำพิพากษา', true, 3),
  ('total_sources', '5', 'แหล่งข้อมูล', 'ทั้งหมดพร้อมใช้', false, 4);

-- Example Questions
insert into example_questions (question, sort_order) values
  ('จะเปิดซาวน่าในโรงแรม ต้องขอใบอนุญาตอะไรบ้าง?', 1),
  ('ใบอนุญาตขายแอลกอฮอล์ในโรงแรม', 2),
  ('กฎหมายคุ้มครองผู้บริโภค e-commerce', 3),
  ('ภาษีที่ดินและสิ่งปลูกสร้าง สำหรับคอนโด', 4),
  ('สัญญาเช่าที่ดิน 30 ปี ทำยังไง?', 5),
  ('เลิกจ้างพนักงาน ต้องจ่ายชดเชยเท่าไร?', 6);

-- Data Sources
insert into data_sources (name, description, url, status, badges, icon_color, sort_order) values
  ('สำนักงานคณะกรรมการกฤษฎีกา', 'ocs.go.th — พ.ร.บ. / พ.ร.ก. / กฎกระทรวง / รัฐธรรมนูญ / ประมวลกฎหมาย', 'ocs.go.th', 'active', '["พ.ร.บ. 180 ฉบับ", "พ.ร.ก. 25 ฉบับ", "กฎกระทรวง 40 ฉบับ"]', 'brand', 1),
  ('ศาลฎีกา', 'deka.supremecourt.or.th — คำพิพากษาศาลฎีกา ทุกแผนก', 'deka.supremecourt.or.th', 'active', '["แพ่ง 1,400 คดี", "อาญา 980 คดี", "แรงงาน 520 คดี"]', 'purple', 2),
  ('ราชกิจจานุเบกษา', 'ratchakitcha.soc.go.th — ประกาศ คำสั่ง ระเบียบ', 'ratchakitcha.soc.go.th', 'active', '["ประกาศ 300 ฉบับ"]', 'blue', 3),
  ('คณะกรรมการกฤษฎีกา (ความเห็น)', 'ความเห็นคณะกรรมการกฤษฎีกา — บันทึกตีความกฎหมาย', null, 'planned', '["เร็วๆ นี้"]', 'amber', 4),
  ('วิทยานิพนธ์ / บทความวิชาการ', 'บทความวิชาการด้านกฎหมายจากมหาวิทยาลัยชั้นนำ', null, 'planned', '["เร็วๆ นี้"]', 'rose', 5);

-- Releases
insert into releases (version, date, is_latest, items, stats) values
  ('v1.3', '20 มีนาคม 2569', true,
   '[{"tag":"Added","text":"เพิ่ม <strong>พ.ร.บ. การสาธารณสุข พ.ศ. 2535</strong> พร้อมกฎกระทรวงที่เกี่ยวข้อง 12 ฉบับ"},{"tag":"Added","text":"เพิ่ม <strong>คำพิพากษาศาลฎีกา แผนกคดีแรงงาน</strong> ปี 2566 จำนวน 520 คำพิพากษา"},{"tag":"Improved","text":"ปรับปรุง cross-reference ระหว่าง พ.ร.บ. และกฎกระทรวง — ลิงก์อ้างอิงแม่นยำขึ้น"}]',
   'รวม: 245 ฉบับ · 12,400 มาตรา · 3,200 คำพิพากษา'),
  ('v1.2', '5 มีนาคม 2569', false,
   '[{"tag":"Added","text":"เพิ่มราชกิจจานุเบกษา 300 ฉบับ (ประกาศ คำสั่ง ระเบียบ)"},{"tag":"Added","text":"เพิ่มคำพิพากษาศาลฎีกา แผนกคดีอาญา ปี 2565-2566"},{"tag":"Improved","text":"ปรับปรุงระบบค้นหาให้รองรับ synonym (คำพ้องความหมาย)"},{"tag":"Fixed","text":"แก้ไขลิงก์อ้างอิงมาตราที่เชื่อมผิดฉบับ"}]',
   null),
  ('v1.1', '15 กุมภาพันธ์ 2569', false,
   '[{"tag":"Added","text":"เพิ่มคำพิพากษาศาลฎีกา แผนกคดีแพ่ง ปี 2565-2566 จำนวน 1,400 คำพิพากษา"},{"tag":"Improved","text":"ปรับปรุง AI ให้ตอบคำถามเกี่ยวกับประมวลกฎหมายได้แม่นยำขึ้น"}]',
   null),
  ('v1.0', '1 กุมภาพันธ์ 2569', false,
   '[{"tag":"Added","text":"เปิดตัวระบบ Legal AI พร้อม พ.ร.บ. 180 ฉบับจาก ocs.go.th"},{"tag":"Added","text":"ระบบแชท AI ถาม-ตอบกฎหมายภาษาไทย"},{"tag":"Added","text":"Law Viewer สำหรับอ่านเนื้อกฎหมายฉบับเต็ม"}]',
   null);

-- Demo Law
insert into laws (id, title, source) values
  ('00000000-0000-0000-0000-000000000001', 'พระราชบัญญัติโรงแรม พ.ศ. 2547', 'https://ocs.go.th');

insert into law_sections (law_id, number, title, content, sort_order) values
  ('00000000-0000-0000-0000-000000000001', 'มาตรา 3', 'บทนิยาม',
   E'ในพระราชบัญญัตินี้\n\n"โรงแรม" หมายความว่า สถานที่พักที่จัดตั้งขึ้นโดยมีวัตถุประสงค์ในทางธุรกิจเพื่อให้บริการที่พักชั่วคราวสำหรับคนเดินทางหรือบุคคลอื่นใดโดยมีค่าตอบแทน\n\n"ผู้จัดการ" หมายความว่า บุคคลซึ่งได้รับแต่งตั้งจากเจ้าของหรือผู้ดำเนินกิจการโรงแรมให้เป็นผู้จัดการโรงแรม\n\n"นายทะเบียน" หมายความว่า นายทะเบียนโรงแรมซึ่งรัฐมนตรีแต่งตั้งตามพระราชบัญญัตินี้\n\n"พนักงานเจ้าหน้าที่" หมายความว่า ผู้ซึ่งรัฐมนตรีแต่งตั้งให้ปฏิบัติการตามพระราชบัญญัตินี้\n\n"รัฐมนตรี" หมายความว่า รัฐมนตรีผู้รักษาการตามพระราชบัญญัตินี้',
   1),
  ('00000000-0000-0000-0000-000000000001', 'มาตรา 4', 'การยกเว้น',
   E'พระราชบัญญัตินี้มิให้ใช้บังคับแก่\n\n(1) สถานที่พักที่จัดตั้งขึ้นเพื่อให้บริการที่พักชั่วคราวซึ่งดำเนินการโดยส่วนราชการ รัฐวิสาหกิจ หรือหน่วยงานอื่นของรัฐ\n\n(2) สถานที่พักที่จัดตั้งขึ้นโดยมีวัตถุประสงค์เพื่อการกุศลหรือการศึกษา โดยมิได้แสวงหากำไร\n\n(3) สถานที่พักอื่นตามที่กำหนดในกฎกระทรวง',
   2),
  ('00000000-0000-0000-0000-000000000001', 'มาตรา 5', 'ประเภทของโรงแรม',
   E'โรงแรมแบ่งออกเป็นประเภทต่าง ๆ ตามที่กำหนดในกฎกระทรวง\n\nการกำหนดประเภทของโรงแรมตามวรรคหนึ่ง ให้คำนึงถึงลักษณะของอาคาร สิ่งอำนวยความสะดวก การให้บริการ และการบริหารจัดการของโรงแรม',
   3),
  ('00000000-0000-0000-0000-000000000001', 'มาตรา 15', 'การขอใบอนุญาต',
   E'ผู้ใดประสงค์จะประกอบธุรกิจโรงแรม ให้ยื่นคำขอรับใบอนุญาตต่อนายทะเบียน\n\nการขอรับใบอนุญาตและการออกใบอนุญาต ให้เป็นไปตามหลักเกณฑ์ วิธีการ และเงื่อนไขที่กำหนดในกฎกระทรวง\n\nใบอนุญาตประกอบธุรกิจโรงแรมให้มีอายุห้าปีนับแต่วันที่ออกใบอนุญาต',
   4),
  ('00000000-0000-0000-0000-000000000001', 'มาตรา 16', 'คุณสมบัติผู้ขอใบอนุญาต',
   E'ผู้ขอรับใบอนุญาตประกอบธุรกิจโรงแรมต้องมีคุณสมบัติและไม่มีลักษณะต้องห้าม ดังต่อไปนี้\n\n(1) เป็นบุคคลธรรมดาซึ่งมีสัญชาติไทย หรือเป็นนิติบุคคลซึ่งจดทะเบียนตามกฎหมายไทย\n\n(2) มีอายุไม่ต่ำกว่ายี่สิบปีบริบูรณ์ ในกรณีที่เป็นบุคคลธรรมดา\n\n(3) ไม่เป็นบุคคลล้มละลาย\n\n(4) ไม่เคยได้รับโทษจำคุกโดยคำพิพากษาถึงที่สุดให้จำคุก เว้นแต่เป็นโทษสำหรับความผิดที่ได้กระทำโดยประมาทหรือความผิดลหุโทษ\n\n(5) ไม่เป็นผู้อยู่ระหว่างถูกสั่งพักใช้ใบอนุญาตหรือเคยถูกเพิกถอนใบอนุญาตตามพระราชบัญญัตินี้',
   5);
