-- ==============================================================================
-- ROLLBACK MIGRATION: service_groups & fingernail services categorization
-- Description: Safely reverts service_groups migration if ever requested.
--              Preserves all services, prices, durations, and bookings.
-- ==============================================================================

-- 1. Drop foreign key and column from services
ALTER TABLE IF EXISTS services DROP COLUMN IF EXISTS group_id;

-- 2. Drop trigger and service_groups table
DROP TRIGGER IF EXISTS trg_service_groups_updated_at ON service_groups;
DROP TABLE IF EXISTS service_groups CASCADE;
