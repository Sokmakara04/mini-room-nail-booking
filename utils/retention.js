const { getLocalToday, DEFAULT_TIMEZONE } = require('./scheduler');

/**
 * Calculate retention cutoff boundary based on retentionDays (default: 90 days / 3 months)
 * in salon timezone (Asia/Phnom_Penh).
 */
function getRetentionCutoff(retentionDays = 90, timeZone = DEFAULT_TIMEZONE) {
  const todayStr = getLocalToday(timeZone);
  const [y, m, d] = todayStr.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  base.setUTCDate(base.getUTCDate() - Number(retentionDays));
  const cutoffDate = base.toISOString().slice(0, 10);
  const cutoffTimestamp = base.toISOString();
  return { todayStr, cutoffDate, cutoffTimestamp, timeZone, retentionDays: Number(retentionDays) };
}

/**
 * Preview eligible records for deletion without deleting anything (Dry Run)
 */
async function previewExpiredBookings(supabase, options = {}) {
  const retentionDays = options.retentionDays || 90;
  const timeZone = options.timeZone || DEFAULT_TIMEZONE;
  const { todayStr, cutoffDate, cutoffTimestamp } = getRetentionCutoff(retentionDays, timeZone);

  // Eligibility criteria:
  // 1. Appointment date strictly before cutoff date (< cutoffDate, e.g. > 90 days ago)
  // 2. AND created_at strictly before cutoff timestamp (< cutoffTimestamp)
  // 3. AND date is strictly before today (ALWAYS PROTECT future appointments)
  const { data, error } = await supabase
    .from('bookings')
    .select('id, booking_reference, customer_name, date, time, status, created_at')
    .lt('date', cutoffDate)
    .lt('created_at', cutoffTimestamp)
    .lt('date', todayStr)
    .order('date', { ascending: true });

  if (error) {
    throw new Error(`Failed to query eligible expired bookings: ${error.message}`);
  }

  const eligible = data || [];
  const statusCounts = {};
  for (const b of eligible) {
    statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
  }

  return {
    dryRun: true,
    cutoffDate,
    cutoffTimestamp,
    todayStr,
    timeZone,
    retentionDays,
    eligibleCount: eligible.length,
    statusBreakdown: statusCounts,
    sampleRecords: eligible.slice(0, 50).map(b => ({
      id: b.id,
      ref: b.booking_reference,
      date: b.date,
      status: b.status,
      createdAt: b.created_at
    }))
  };
}

/**
 * Permanently delete eligible expired records (> 90 days old)
 * Idempotent, safe, protects future appointments, logs count without exposing PII.
 */
async function executeExpiredBookingsCleanup(supabase, options = {}) {
  const retentionDays = options.retentionDays || 90;
  const timeZone = options.timeZone || DEFAULT_TIMEZONE;
  const { todayStr, cutoffDate, cutoffTimestamp } = getRetentionCutoff(retentionDays, timeZone);

  // Query eligible records strictly matching expiration boundaries
  const { data: eligible, error: selectError } = await supabase
    .from('bookings')
    .select('id, booking_reference, customer_name, phone, date, status, created_at')
    .lt('date', cutoffDate)
    .lt('created_at', cutoffTimestamp)
    .lt('date', todayStr);

  if (selectError) {
    throw new Error(`Cleanup selection query failed: ${selectError.message}`);
  }

  if (!eligible || eligible.length === 0) {
    console.log(`[Retention Cleanup] 0 expired bookings found older than ${cutoffDate} (Retention: ${retentionDays} days). No deletion required.`);
    return {
      success: true,
      deletedCount: 0,
      cutoffDate,
      timeZone,
      backupPath: null
    };
  }

  // Backup records before deletion if backup option is provided
  let backupPath = null;
  if (options.backup !== false) {
    try {
      const fs = require('fs');
      const path = require('path');
      const backupDir = path.join(__dirname, '../scratch/backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      backupPath = path.join(backupDir, `deleted_bookings_${Date.now()}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(eligible, null, 2), 'utf8');
      console.log(`[Retention Backup] Saved ${eligible.length} records to backup before cleanup: ${backupPath}`);
    } catch (bkErr) {
      console.warn('[Retention Warning] Backup file creation warning:', bkErr.message);
    }
  }

  const idsToDelete = eligible.map(r => r.id);

  // Delete from bookings table
  const { error: deleteError } = await supabase
    .from('bookings')
    .delete()
    .in('id', idsToDelete);

  if (deleteError) {
    console.error(`[Retention Cleanup Error] Deletion failed: ${deleteError.message}`);
    throw new Error(`Retention cleanup deletion failed: ${deleteError.message}`);
  }

  console.log(`[Retention Cleanup] Successfully deleted ${idsToDelete.length} expired booking records older than ${cutoffDate} (${timeZone}).`);

  return {
    success: true,
    deletedCount: idsToDelete.length,
    cutoffDate,
    timeZone,
    backupPath
  };
}

module.exports = {
  getRetentionCutoff,
  previewExpiredBookings,
  executeExpiredBookingsCleanup
};
