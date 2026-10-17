const { supabase } = require('../config/supabase');

function toCamelSettings(row) {
  if (!row) return null;
  const s = {
    id: String(row.id),
    _id: String(row.id),
    salonName: row.salon_name || 'Mini Room Nail & Eyelash',
    salonPhone: row.salon_phone || '012345678',
    openingTime: row.opening_time || '09:00',
    closingTime: row.closing_time || '19:00',
    slotIntervalMinutes: Number(row.slot_interval_minutes || 30),
    workingDays: Array.isArray(row.working_days) ? row.working_days.map(Number) : [0, 1, 2, 3, 4, 5, 6],
    breakStart: row.break_start || '12:30',
    breakEnd: row.break_end || '13:30',
    daysOff: Array.isArray(row.days_off) ? row.days_off : [],
    maxConcurrentStaff: Number(row.max_concurrent_staff || 2),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  s.save = async function () {
    const payload = {
      salon_name: this.salonName,
      salon_phone: this.salonPhone,
      opening_time: this.openingTime,
      closing_time: this.closingTime,
      slot_interval_minutes: this.slotIntervalMinutes,
      working_days: this.workingDays,
      break_start: this.breakStart,
      break_end: this.breakEnd,
      days_off: this.daysOff,
      max_concurrent_staff: this.maxConcurrentStaff
    };

    const { data, error } = await supabase
      .from('salon_settings')
      .update(payload)
      .eq('id', this.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save salon settings to Supabase: ${error.message}`);
    }
    return toCamelSettings(data);
  };

  return s;
}

const SalonSetting = {
  async getSettings() {
    const { data, error } = await supabase
      .from('salon_settings')
      .select('*')
      .limit(1);

    if (error) {
      console.error('[Supabase Error] getSettings:', error.message);
    }

    if (data && data.length > 0) {
      return toCamelSettings(data[0]);
    }

    // Default settings fallback & creation
    const defaultSettings = {
      salon_name: process.env.SALON_NAME || 'Mini Room Nail & Eyelash',
      salon_phone: process.env.SALON_PHONE || '012345678',
      opening_time: '09:00',
      closing_time: '19:00',
      slot_interval_minutes: 30,
      working_days: [0, 1, 2, 3, 4, 5, 6],
      break_start: '12:30',
      break_end: '13:30',
      days_off: [],
      max_concurrent_staff: 2
    };

    const { data: created, error: createError } = await supabase
      .from('salon_settings')
      .insert([defaultSettings])
      .select()
      .single();

    if (createError) {
      console.warn('[Supabase Warning] Could not persist default settings:', createError.message);
      return toCamelSettings({ id: 'local-default', ...defaultSettings });
    }

    return toCamelSettings(created);
  }
};

module.exports = SalonSetting;
