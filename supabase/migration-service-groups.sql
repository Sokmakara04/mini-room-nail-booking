-- ==============================================================================
-- MIGRATION: service_groups & fingernail services categorization
-- Description: Creates the service_groups table, adds group_id foreign key
--              to services table, and assigns all existing services to their groups.
-- Safe & Idempotent: Uses IF NOT EXISTS and ON CONFLICT checks.
-- ==============================================================================

-- 1. Create table: service_groups
CREATE TABLE IF NOT EXISTS service_groups (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(150) NOT NULL,
  name_km VARCHAR(200) NOT NULL,
  description TEXT DEFAULT '',
  description_km TEXT DEFAULT '',
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at on service_groups
DROP TRIGGER IF EXISTS trg_service_groups_updated_at ON service_groups;
CREATE TRIGGER trg_service_groups_updated_at
  BEFORE UPDATE ON service_groups
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_service_groups_active_order ON service_groups (is_active, display_order);

-- 2. Add group_id column to services table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'services' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE services ADD COLUMN group_id TEXT REFERENCES service_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_services_group_id ON services (group_id);

-- 3. Seed canonical fingernail service groups
INSERT INTO service_groups (id, name, name_km, description, description_km, display_order, is_active)
VALUES
  (
    'grp-basic-manicure',
    'Basic Manicure & Care',
    'ថែទាំនិងសម្អាតក្រចក',
    'Essential fingernail care, cuticle trimming, shaping, hand and feet spa treatments.',
    'សេវាកម្មថែទាំនិងកាត់សម្អាតក្រចក ម៉ាស្សា និងស្ក្រាប់ដៃជើងបំប៉នសុខភាពក្រចក។',
    1,
    TRUE
  ),
  (
    'grp-gel-polish',
    'Gel Polish',
    'លាបពណ៌ជែល',
    'Solid gel, syrup gel, cat-eye, and French ombre gel polish treatments.',
    'លាបពណ៌ជែលម្សៅ ជែលថ្លា ជែលឆក់ និងម៉ូដ French / Ombre ភ្លឺរលោងជាប់បានយូរ។',
    2,
    TRUE
  ),
  (
    'grp-nail-extensions',
    'Nail Extensions & Overlay',
    'តនិងអប់ក្រចក',
    'Full nail extensions, builder gel overlay, and flawless nail length enhancements.',
    'តប្រវែងក្រចកដៃដោយជែល អប់ជែល និងបិតក្រចកពេញដើម្បីរាងក្រចករឹងមាំស្រស់ស្អាត។',
    3,
    TRUE
  ),
  (
    'grp-nail-art',
    'Nail Art & Design',
    'ម៉ូដនិងសិល្បៈក្រចក',
    'Custom hand-painted nail art, minimalist lines, 3D characters, flowers, and chrome isolation.',
    'គូរម៉ូដសិល្បៈក្រចកដៃ រចនាក្បាច់ 3D ផ្កាប៉ោង ត្រាស៊ីលីកូន និង Chrome ប្លែកទាន់សម័យ។',
    4,
    TRUE
  ),
  (
    'grp-nail-removal',
    'Nail Removal',
    'ដោះក្រចកជែលនិងម្សៅ',
    'Gentle and damage-free removal of gel polish, overlay, gel extensions, and acrylic nails.',
    'ដោះថ្នាំជែលចាស់ អប់ជែល តជែល និងម្សៅចេញដោយសុវត្ថិភាព មិនប៉ះពាល់ដល់ក្រចកធម្មជាតិ។',
    5,
    TRUE
  ),
  (
    'grp-nail-repair',
    'Nail Repair & Maintenance',
    'ជួសជុលនិងថែទាំក្រចក',
    'Fix broken fingernails, refills for gel extensions, overlays, and gel x maintenance.',
    'កែក្រចកបាក់ ឬខូច និងបំពេញបន្ថែម (Refill) សម្រាប់ក្រចកតជែល អប់ជែល និង Gel X។',
    6,
    TRUE
  ),
  (
    'grp-packages',
    'Packages & Promotions',
    'កញ្ចប់សេវាកម្មនិងប្រូម៉ូសិន',
    'Bundled salon packages and special promotional offers.',
    'កញ្ចប់សេវាកម្មរួមបញ្ចូលគ្នា និងការផ្តល់ជូនពិសេសពីហាង។',
    7,
    TRUE
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  name_km = EXCLUDED.name_km,
  description = EXCLUDED.description,
  description_km = EXCLUDED.description_km,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- 4. Assign existing services to appropriate groups by ID and keywords
-- Group 1: Basic Manicure & Care
UPDATE services 
SET group_id = 'grp-basic-manicure' 
WHERE id IN ('svc-basic-manicure', 'svc-french-manicure', 'svc-nail-art', 'svc-gel-removal')
   OR name ILIKE '%cuticle%' 
   OR name ILIKE '%spa%' 
   OR name ILIKE '%manicure - pedicure%';

-- Group 2: Gel Polish
UPDATE services 
SET group_id = 'grp-gel-polish' 
WHERE id IN (
  '60236ef2-ad10-49ca-b041-0ee8e28c0162',
  'e2acd9e5-2647-4957-9523-daf9774678e0',
  '33e6c177-2fb7-460f-9f64-2fe49fa4ed2c',
  '19170834-aaf1-4200-806c-3db23a9940e0',
  '194a630e-8e24-4239-b671-e73bf86ffc11',
  'd6bb82c1-9070-4d11-ad33-1baf7855df3b',
  '1efcd824-b98c-4de6-8d27-082de9c26673',
  'ef101fac-5def-4f73-ad77-1ae3f4dae3f6'
) OR (name ILIKE '%gel polish%' AND name NOT ILIKE '%remove%' AND name NOT ILIKE '%refill%')
  OR name ILIKE '%gel color%'
  OR (name ILIKE '%solid gel%' AND name NOT ILIKE '%refill%')
  OR (name ILIKE '%french / ombre%' AND name NOT ILIKE '%refill%');

-- Group 3: Nail Extensions & Overlay
UPDATE services 
SET group_id = 'grp-nail-extensions' 
WHERE id IN (
  'e1e41762-ddb4-4f01-8b14-4ca734eb9f44',
  'fe023eb3-db35-475a-8117-d6edd0512042',
  'bd0579e8-69b0-4dc8-9c11-b68640e576ea'
) OR (name ILIKE '%extension%' AND name NOT ILIKE '%remove%' AND name NOT ILIKE '%refill%')
  OR (name ILIKE '%overlay%' AND name NOT ILIKE '%remove%' AND name NOT ILIKE '%refill%')
  OR name ILIKE '%បិតក្រចកពេញ%';

-- Group 4: Nail Art & Design
UPDATE services 
SET group_id = 'grp-nail-art' 
WHERE id IN (
  '1e39448a-4442-4017-8e35-b401739439b5',
  '20456b73-fb5d-4260-b7b2-a0d564d3b25e',
  '736fc411-5fa6-408b-b9d1-1b8e93e719f8',
  '9806e376-4268-4269-af2b-0d7fb947b975',
  'd852cf7e-3dfe-494b-be8c-48907fe35bdf',
  'c4e1bdf9-b6c4-47da-8490-a228f6eeab53',
  '350d7db8-a610-4b72-b9bd-23db5cdbb8ad'
) OR name ILIKE '%art%'
  OR name ILIKE '%design%'
  OR name ILIKE '%character%'
  OR name ILIKE '%flower%'
  OR name ILIKE '%stamp%'
  OR name ILIKE '%chrome%';

-- Group 5: Nail Removal
UPDATE services 
SET group_id = 'grp-nail-removal' 
WHERE id IN (
  'e59943b1-76a9-4af5-a77c-15d22cd89fda',
  '221c1604-5651-4000-b56a-5c675c9da86c',
  'd9c8be34-9419-4fc0-a861-511ad7830582',
  '0c7f600f-d288-42aa-b2b5-c88e12f01c42'
) OR name ILIKE '%remove%';

-- Group 6: Nail Repair & Maintenance
UPDATE services 
SET group_id = 'grp-nail-repair' 
WHERE id IN (
  'svc-gel-polish',
  'ad47242f-8e78-489e-8e7d-8fb4cc08773d',
  'cb690cea-0e0d-4fc3-abed-2d987294a344',
  '0cdefb63-b4d5-4976-bc7d-fac991b89706'
) OR name ILIKE '%broken%'
  OR name ILIKE '%refill%'
  OR name ILIKE '%repair%';

-- Default any remaining unclassified services to 'grp-basic-manicure'
UPDATE services
SET group_id = 'grp-basic-manicure'
WHERE group_id IS NULL;
