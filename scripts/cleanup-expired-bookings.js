#!/usr/bin/env node
require('dotenv').config();
const { supabase } = require('../config/supabase');
const {
  getRetentionCutoff,
  previewExpiredBookings,
  executeExpiredBookingsCleanup
} = require('../utils/retention');

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || !args.includes('--execute');
  const retentionDaysArg = args.find(a => a.startsWith('--days='));
  const retentionDays = retentionDaysArg ? Number(retentionDaysArg.split('=')[1]) : 90;

  console.log('===============================================================');
  console.log('   MINI ROOM NAIL & EYELASH - 3-MONTH BOOKING RETENTION CLEANUP');
  console.log('===============================================================');

  const { todayStr, cutoffDate, timeZone } = getRetentionCutoff(retentionDays);
  console.log(`Current Date:  ${todayStr} (${timeZone})`);
  console.log(`Cutoff Date:   ${cutoffDate} (${retentionDays} days retention boundary)`);
  console.log(`Mode:          ${isDryRun ? 'DRY-RUN (Preview only, no data deleted)' : 'EXECUTE (Permanent deletion)'}`);
  console.log('---------------------------------------------------------------');

  if (isDryRun) {
    const preview = await previewExpiredBookings(supabase, { retentionDays, timeZone });
    console.log(`Total eligible expired records: ${preview.eligibleCount}`);
    console.log('Breakdown by status:', preview.statusBreakdown);
    if (preview.sampleRecords.length > 0) {
      console.log('\nSample records that would be removed:');
      console.table(preview.sampleRecords.slice(0, 10));
    } else {
      console.log('\n✓ No expired records currently qualify for retention deletion.');
    }
    console.log('\nℹ️ To permanently execute deletion, run:');
    console.log('   node scripts/cleanup-expired-bookings.js --execute');
  } else {
    console.log('Executing retention cleanup...');
    const result = await executeExpiredBookingsCleanup(supabase, { retentionDays, timeZone });
    console.log('---------------------------------------------------------------');
    console.log(`✓ Cleanup Complete: Deleted ${result.deletedCount} expired booking records.`);
    if (result.backupPath) {
      console.log(`📁 Backup preserved at: ${result.backupPath}`);
    }
  }
}

main().catch(err => {
  console.error('\n❌ Retention Cleanup Failed:', err.message);
  process.exit(1);
});
