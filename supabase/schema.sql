-- ==============================================================================
-- Supabase PostgreSQL Schema for Nail Salon Booking System
-- ==============================================================================
-- This script creates all required tables, constraints, indexes, RLS policies,
-- and seeds the initial default fingernail services and salon settings.
-- It is idempotent and safe to run in the Supabase SQL Editor.
-- ==============================================================================

-- 1. Enable pgcrypto for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. CREATE FUNCTION for automatically updating updated_at timestamp
-- ==============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 3. TABLE: users (System Admins & Staff Accounts)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin', -- 'admin', 'staff', 'manager'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 4. TABLE: services (Fingernail Services & Treatments)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(150) NOT NULL,
  name_km VARCHAR(200) NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  duration_minutes INT NOT NULL DEFAULT 45 CHECK (duration_minutes >= 10 AND duration_minutes <= 240),
  description TEXT DEFAULT '',
  description_km TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  category VARCHAR(50) NOT NULL DEFAULT 'fingernail',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_services_updated_at ON services;
CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_services_active_category ON services (is_active, category);

-- ==============================================================================
-- 5. TABLE: salon_settings (Salon Hours, Capacity & Booking Rules)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS salon_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  salon_name VARCHAR(150) NOT NULL DEFAULT 'Mini Room Nail & Eyelash',
  salon_phone VARCHAR(50) NOT NULL DEFAULT '012345678',
  opening_time VARCHAR(10) NOT NULL DEFAULT '09:00',
  closing_time VARCHAR(10) NOT NULL DEFAULT '19:00',
  slot_interval_minutes INT NOT NULL DEFAULT 30 CHECK (slot_interval_minutes BETWEEN 15 AND 60),
  working_days JSONB NOT NULL DEFAULT '[0, 1, 2, 3, 4, 5, 6]'::jsonb, -- 0=Sun, 1=Mon, ..., 6=Sat
  break_start VARCHAR(10) DEFAULT '12:30',
  break_end VARCHAR(10) DEFAULT '13:30',
  days_off JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of 'YYYY-MM-DD'
  max_concurrent_staff INT NOT NULL DEFAULT 2 CHECK (max_concurrent_staff BETWEEN 1 AND 20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_salon_settings_updated_at ON salon_settings;
CREATE TRIGGER trg_salon_settings_updated_at
  BEFORE UPDATE ON salon_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 6. TABLE: bookings (Customer Appointment Bookings)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  booking_reference VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(150) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  service_id TEXT REFERENCES services(id) ON DELETE SET NULL,
  service VARCHAR(150) NOT NULL,
  service_km VARCHAR(200) DEFAULT '',
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  duration_minutes INT NOT NULL DEFAULT 45,
  date VARCHAR(10) NOT NULL,     -- Format: YYYY-MM-DD
  time VARCHAR(10) NOT NULL,     -- Format: HH:mm start time
  end_time VARCHAR(10) NOT NULL, -- Format: HH:mm calculated end time
  notes TEXT DEFAULT '',
  admin_notes TEXT DEFAULT '',
  telegram_id VARCHAR(50) DEFAULT '',
  source VARCHAR(20) NOT NULL DEFAULT 'website' CHECK (source IN ('website', 'telegram')),
  language VARCHAR(10) NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'km')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON bookings;
CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON bookings (date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_ref ON bookings (booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings (phone);
CREATE INDEX IF NOT EXISTS idx_bookings_date_time ON bookings (date, time);

-- ==============================================================================
-- 7. TABLE: staff (Staff / Nail Technicians)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(50) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  role VARCHAR(50) NOT NULL DEFAULT 'nail_technician',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_staff_updated_at ON staff;
CREATE TRIGGER trg_staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ==============================================================================
-- 8. TABLE: notifications (Telegram / SMS Notification History)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  booking_id TEXT REFERENCES bookings(id) ON DELETE CASCADE,
  recipient VARCHAR(100) NOT NULL,
  channel VARCHAR(50) NOT NULL DEFAULT 'telegram',
  message TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'delivered'
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_booking ON notifications (booking_id);

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Secure application data by enabling RLS on all tables.
-- The Express backend operates with the SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
-- Public anon key access is restricted to protect sensitive customer data.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE salon_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Services: Allow public read access to active services so visitors can view catalog
DROP POLICY IF EXISTS "Public can view active services" ON services;
CREATE POLICY "Public can view active services"
  ON services FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

-- Salon Settings: Allow public read access to salon hours and settings for booking calendar
DROP POLICY IF EXISTS "Public can view salon settings" ON salon_settings;
CREATE POLICY "Public can view salon settings"
  ON salon_settings FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Bookings, Users, Staff, Notifications:
-- Direct public modification or reading via anon REST API is denied.
-- All operations are performed securely through the Node.js Express backend.

-- ==============================================================================
-- 10. PRE-SEED DEFAULT SERVICES & SALON SETTINGS (Safe Idempotent Insert)
-- ==============================================================================

-- Seed default salon settings if table is empty
INSERT INTO salon_settings (id, salon_name, salon_phone, opening_time, closing_time, slot_interval_minutes, working_days, break_start, break_end, days_off, max_concurrent_staff)
SELECT
  'default-salon-settings',
  'Mini Room Nail & Eyelash',
  '012345678',
  '09:00',
  '19:00',
  30,
  '[0, 1, 2, 3, 4, 5, 6]'::jsonb,
  '12:30',
  '13:30',
  '[]'::jsonb,
  2
WHERE NOT EXISTS (SELECT 1 FROM salon_settings);

-- Seed default fingernail services if services table is empty
INSERT INTO services (id, name, name_km, price, duration_minutes, description, description_km, image_url, category, is_active)
SELECT
  'svc-basic-manicure',
  'Basic Manicure',
  'កាត់និងសម្អាតក្រចកដៃមូលដ្ឋាន',
  12.00,
  35,
  'Nail shaping, cuticle trimming, gentle buffing, and nourishing hand massage.',
  'កាត់តម្រឹមរាងក្រចក សម្អាតគល់ក្រចក និងម៉ាស្សាបាតដៃយ៉ាងទន់ភ្លន់។',
  'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=600&q=80',
  'fingernail',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Basic Manicure');

INSERT INTO services (id, name, name_km, price, duration_minutes, description, description_km, image_url, category, is_active)
SELECT
  'svc-gel-polish',
  'Gel Nail Polish',
  'លាបថ្នាំជែលក្រចកដៃ',
  20.00,
  45,
  'Long-lasting premium gel polish with high-gloss shine and UV-LED cure.',
  'លាបថ្នាំជែលជាប់បានយូរ ភ្លឺរលោងស្អាត និងស្ងួតឆាប់រហ័សដោយពន្លឺ UV-LED។',
  'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=600&q=80',
  'fingernail',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Gel Nail Polish');

INSERT INTO services (id, name, name_km, price, duration_minutes, description, description_km, image_url, category, is_active)
SELECT
  'svc-nail-art',
  'Nail Art Design',
  'គូរម៉ូដសិល្បៈក្រចកដៃ',
  28.00,
  60,
  'Custom creative hand-painted nail art, minimalist lines, chrome, or glitter finish.',
  'គូរម៉ូដសិល្បៈក្រចកដៃតាមចំណូលចិត្ត ក្បាច់រចនាស្អាតប្លែក និងទាន់សម័យ។',
  'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=600&q=80',
  'fingernail',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Nail Art Design');

INSERT INTO services (id, name, name_km, price, duration_minutes, description, description_km, image_url, category, is_active)
SELECT
  'svc-nail-extensions',
  'Nail Extensions (Gel / Acrylic)',
  'តក្រចកដៃ (ជែល ឬ អាគ្រីលីក)',
  38.00,
  75,
  'Full set fingernail extensions to add length and strength with flawless shaping.',
  'តប្រវែងក្រចកដៃឱ្យស្រស់ស្អាត រឹងមាំ និងរាងសមសួនទាក់ទាញ។',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80',
  'fingernail',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Nail Extensions (Gel / Acrylic)');

INSERT INTO services (id, name, name_km, price, duration_minutes, description, description_km, image_url, category, is_active)
SELECT
  'svc-gel-removal',
  'Gel Removal & Care',
  'ដោះជែលនិងថែបំប៉នក្រចកដៃ',
  10.00,
  25,
  'Gentle, damage-free gel polish removal followed by cuticle oil and keratin strengthener.',
  'ដោះថ្នាំជែលចាស់ចេញដោយមិនប៉ះពាល់ក្រចក រួមជាមួយការបំប៉នប្រេងខេរ៉ាទីន។',
  'https://images.unsplash.com/photo-1599839575945-a9e5af0c3fa5?auto=format&fit=crop&w=600&q=80',
  'fingernail',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Gel Removal & Care');

INSERT INTO services (id, name, name_km, price, duration_minutes, description, description_km, image_url, category, is_active)
SELECT
  'svc-french-manicure',
  'French Manicure Tips',
  'ម៉ូដក្រចកបារាំង (French Manicure)',
  24.00,
  50,
  'Timeless classic French tips manicure with natural pink base and crisp white edges.',
  'រចនាបែបបារាំងបុរាណ គល់ផ្កាឈូកធម្មជាតិ និងចុងក្រចកពណ៌សយ៉ាងផ្ចិតផ្ចង់។',
  'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=600&q=80',
  'fingernail',
  TRUE
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'French Manicure Tips');
