require('dotenv').config();
const mongoose = require('mongoose');
const { supabase, testConnection } = require('../config/supabase');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/beauty_salon_booking';

async function runMigration() {
  console.log('====================================================');
  console.log('   MIGRATION: MongoDB Atlas -> Supabase PostgreSQL  ');
  console.log('====================================================\n');

  // 1. Verify Supabase connection
  console.log('[Step 1] Checking Supabase connection...');
  const conn = await testConnection();
  if (!conn.ok) {
    console.error('❌ Supabase connection failed:');
    console.error(conn.message);
    console.error('\nPlease ensure:');
    console.error('1. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
    console.error('2. You have executed supabase/schema.sql in the Supabase SQL Editor');
    process.exit(1);
  }
  console.log('✅ Supabase connected successfully.\n');

  // 2. Connect to MongoDB
  console.log(`[Step 2] Connecting to MongoDB: ${MONGODB_URI.replace(/:([^:@]{3,})@/, ':***@')} ...`);
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ MongoDB connected successfully.\n');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.log('Skipping data extraction from MongoDB. If you have no existing MongoDB data, Supabase is ready to use.');
    process.exit(1);
  }

  const db = mongoose.connection.db;

  // 3. Migrate Salon Settings
  console.log('[Step 3] Migrating Salon Settings...');
  const rawSettings = await db.collection('salonsettings').find().toArray();
  let settingsMigrated = 0;
  for (const s of rawSettings) {
    const payload = {
      id: String(s._id),
      salon_name: s.salonName || 'Mini Room Nail & Eyelash',
      salon_phone: s.salonPhone || '012345678',
      opening_time: s.openingTime || '09:00',
      closing_time: s.closingTime || '19:00',
      slot_interval_minutes: Number(s.slotIntervalMinutes || 30),
      working_days: s.workingDays || [0, 1, 2, 3, 4, 5, 6],
      break_start: s.breakStart || '12:30',
      break_end: s.breakEnd || '13:30',
      days_off: s.daysOff || [],
      max_concurrent_staff: Number(s.maxConcurrentStaff || 2)
    };

    const { error } = await supabase
      .from('salon_settings')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error(`  ❌ Failed to migrate salon setting ${s._id}:`, error.message);
    } else {
      settingsMigrated++;
    }
  }
  console.log(`  ✓ Migrated ${settingsMigrated}/${rawSettings.length} salon setting(s).\n`);

  // 4. Migrate Fingernail Services
  console.log('[Step 4] Migrating Services...');
  const rawServices = await db.collection('services').find().toArray();
  let servicesMigrated = 0;
  for (const s of rawServices) {
    const payload = {
      id: String(s._id),
      name: s.name,
      name_km: s.nameKm || s.name,
      price: Number(s.price),
      duration_minutes: Number(s.durationMinutes || 45),
      description: s.description || '',
      description_km: s.descriptionKm || '',
      image_url: s.imageUrl || '',
      category: s.category || 'fingernail',
      is_active: Boolean(s.isActive),
      created_at: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
      updated_at: s.updatedAt ? new Date(s.updatedAt).toISOString() : new Date().toISOString()
    };

    const { error } = await supabase
      .from('services')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error(`  ❌ Failed to migrate service "${s.name}" (${s._id}):`, error.message);
    } else {
      servicesMigrated++;
    }
  }
  console.log(`  ✓ Migrated ${servicesMigrated}/${rawServices.length} fingernail service(s).\n`);

  // 5. Migrate Bookings
  console.log('[Step 5] Migrating Bookings...');
  const rawBookings = await db.collection('bookings').find().toArray();
  let bookingsMigrated = 0;
  let bookingsSkipped = 0;

  for (const b of rawBookings) {
    const payload = {
      id: String(b._id),
      booking_reference: b.bookingReference,
      customer_name: b.customerName,
      phone: b.phone,
      service_id: b.serviceId ? String(b.serviceId) : null,
      service: b.service,
      service_km: b.serviceKm || '',
      price: Number(b.price),
      duration_minutes: Number(b.durationMinutes || 45),
      date: b.date,
      time: b.time,
      end_time: b.endTime,
      notes: b.notes || '',
      admin_notes: b.adminNotes || '',
      telegram_id: b.telegramId || '',
      source: b.source || 'website',
      language: b.language || 'en',
      status: b.status || 'pending',
      created_at: b.createdAt ? new Date(b.createdAt).toISOString() : new Date().toISOString(),
      updated_at: b.updatedAt ? new Date(b.updatedAt).toISOString() : new Date().toISOString()
    };

    const { error } = await supabase
      .from('bookings')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error(`  ❌ Failed to migrate booking ${b.bookingReference} (${b._id}):`, error.message);
      bookingsSkipped++;
    } else {
      bookingsMigrated++;
    }
  }
  console.log(`  ✓ Migrated ${bookingsMigrated}/${rawBookings.length} booking(s). (Skipped: ${bookingsSkipped})\n`);

  // 6. Migrate / Seed Admin User in Supabase
  console.log('[Step 6] Ensuring Admin User in Supabase...');
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminEmail = `${adminUsername}@miniroonail.local`;
  let adminPassword = (process.env.ADMIN_PASSWORD || 'Ramon11@').trim();
  if (adminPassword === '123' || adminPassword === 'admin123') {
    adminPassword = 'Ramon11@';
  }

  const existingUser = await User.findByEmail(adminEmail);
  if (!existingUser) {
    await User.createUser({
      email: adminEmail,
      password: adminPassword,
      role: 'admin'
    });
    console.log(`  ✓ Created initial admin user (${adminEmail}) in Supabase users table.`);
  } else if (!User.verifyPassword(adminPassword, existingUser.passwordHash)) {
    await User.updatePassword(adminEmail, adminPassword);
    console.log(`  ✓ Synchronized admin user (${adminEmail}) password from .env in Supabase.`);
  } else {
    console.log(`  ✓ Admin user (${adminEmail}) already exists in Supabase users table.`);
  }

  // 7. Verify Record Counts in Supabase
  console.log('\n====================================================');
  console.log('              MIGRATION VERIFICATION                ');
  console.log('====================================================');

  const { count: sbSettingsCount } = await supabase.from('salon_settings').select('*', { count: 'exact', head: true });
  const { count: sbServicesCount } = await supabase.from('services').select('*', { count: 'exact', head: true });
  const { count: sbBookingsCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
  const { count: sbUsersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });

  console.log(`Salon Settings:  MongoDB = ${rawSettings.length}  |  Supabase = ${sbSettingsCount}`);
  console.log(`Services:        MongoDB = ${rawServices.length}  |  Supabase = ${sbServicesCount}`);
  console.log(`Bookings:        MongoDB = ${rawBookings.length}  |  Supabase = ${sbBookingsCount}`);
  console.log(`Users:           Supabase = ${sbUsersCount}`);
  console.log('====================================================');
  console.log('✅ Migration complete! MongoDB data was preserved.');
  console.log('====================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
