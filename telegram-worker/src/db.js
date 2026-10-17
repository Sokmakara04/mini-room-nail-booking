import { createClient } from '@supabase/supabase-js';

export function getSupabase(env) {
  const url = (env.SUPABASE_URL || '').trim();
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY || '').trim();

  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured in worker environment.');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function generateBookingReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'NL-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function getSalonSettings(supabase, defaultName = 'Mini Room Nail & Eyelash') {
  const { data, error } = await supabase
    .from('salon_settings')
    .select('*')
    .limit(1);

  if (error || !data || data.length === 0) {
    return {
      salonName: defaultName,
      salonPhone: '012345678',
      openingTime: '09:00',
      closingTime: '19:00',
      slotIntervalMinutes: 30,
      workingDays: [0, 1, 2, 3, 4, 5, 6],
      breakStart: '12:30',
      breakEnd: '13:30',
      daysOff: [],
      maxConcurrentStaff: 2
    };
  }

  const row = data[0];
  return {
    id: String(row.id),
    salonName: row.salon_name || defaultName,
    salonPhone: row.salon_phone || '012345678',
    openingTime: row.opening_time || '09:00',
    closingTime: row.closing_time || '19:00',
    slotIntervalMinutes: Number(row.slot_interval_minutes || 30),
    workingDays: Array.isArray(row.working_days) ? row.working_days.map(Number) : [0, 1, 2, 3, 4, 5, 6],
    breakStart: row.break_start || '12:30',
    breakEnd: row.break_end || '13:30',
    daysOff: Array.isArray(row.days_off) ? row.days_off : [],
    maxConcurrentStaff: Number(row.max_concurrent_staff || 2)
  };
}

export async function getActiveServices(supabase) {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true)
    .eq('category', 'fingernail')
    .order('price', { ascending: true });

  if (error) {
    console.error('[Supabase getActiveServices Error]:', error.message);
    return [];
  }

  return (data || []).map(s => ({
    _id: String(s.id),
    id: String(s.id),
    name: s.name,
    nameKm: s.name_km,
    price: Number(s.price),
    durationMinutes: Number(s.duration_minutes),
    description: s.description || '',
    descriptionKm: s.description_km || '',
    isActive: s.is_active,
    category: s.category
  }));
}

export async function getServiceById(supabase, id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', String(id))
    .maybeSingle();

  if (error || !data) return null;
  return {
    _id: String(data.id),
    id: String(data.id),
    name: data.name,
    nameKm: data.name_km,
    price: Number(data.price),
    durationMinutes: Number(data.duration_minutes),
    description: data.description || '',
    descriptionKm: data.description_km || '',
    isActive: data.is_active,
    category: data.category
  };
}

export async function createBooking(supabase, bookingData) {
  const ref = bookingData.bookingReference || generateBookingReference();
  const payload = {
    booking_reference: ref,
    customer_name: (bookingData.customerName || '').trim(),
    phone: (bookingData.phone || '').trim(),
    service_id: bookingData.serviceId ? String(bookingData.serviceId) : null,
    service: (bookingData.service || '').trim(),
    service_km: (bookingData.serviceKm || '').trim(),
    price: Number(bookingData.price || 0),
    duration_minutes: Number(bookingData.durationMinutes || 45),
    date: bookingData.date,
    time: bookingData.time,
    end_time: bookingData.endTime,
    notes: (bookingData.notes || '').trim(),
    admin_notes: (bookingData.adminNotes || '').trim(),
    telegram_id: String(bookingData.telegramId || '').trim(),
    source: bookingData.source || 'telegram',
    language: bookingData.language || 'en',
    status: bookingData.status || 'pending'
  };

  const { data, error } = await supabase
    .from('bookings')
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert booking into Supabase: ${error.message}`);
  }

  return {
    _id: String(data.id),
    id: String(data.id),
    bookingReference: data.booking_reference,
    customerName: data.customer_name,
    phone: data.phone,
    serviceId: data.service_id,
    service: data.service,
    serviceKm: data.service_km,
    price: Number(data.price),
    durationMinutes: Number(data.duration_minutes),
    date: data.date,
    time: data.time,
    endTime: data.end_time,
    telegramId: data.telegram_id,
    source: data.source,
    language: data.language,
    status: data.status,
    createdAt: data.created_at
  };
}

export async function findBookingById(supabase, id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', String(id))
    .maybeSingle();

  if (error || !data) return null;
  return {
    _id: String(data.id),
    id: String(data.id),
    bookingReference: data.booking_reference,
    customerName: data.customer_name,
    phone: data.phone,
    serviceId: data.service_id,
    service: data.service,
    serviceKm: data.service_km,
    price: Number(data.price),
    durationMinutes: Number(data.duration_minutes),
    date: data.date,
    time: data.time,
    endTime: data.end_time,
    telegramId: data.telegram_id,
    source: data.source,
    language: data.language,
    status: data.status,
    notes: data.notes,
    adminNotes: data.admin_notes
  };
}

export async function updateBookingStatus(supabase, id, status) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', String(id))
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update booking status: ${error.message}`);
  }

  return {
    _id: String(data.id),
    id: String(data.id),
    bookingReference: data.booking_reference,
    customerName: data.customer_name,
    phone: data.phone,
    service: data.service,
    serviceKm: data.service_km,
    price: Number(data.price),
    durationMinutes: Number(data.duration_minutes),
    date: data.date,
    time: data.time,
    endTime: data.end_time,
    telegramId: data.telegram_id,
    source: data.source,
    language: data.language,
    status: data.status
  };
}

export async function findBookingsByQuery(supabase, queryText) {
  const clean = (queryText || '').trim();
  if (!clean) return [];

  // Search by exact/prefix booking_reference or phone
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .or(`booking_reference.ilike.%${clean}%,phone.ilike.%${clean}%`)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('[Supabase findBookings Error]:', error.message);
    return [];
  }

  return (data || []).map(b => ({
    _id: String(b.id),
    id: String(b.id),
    bookingReference: b.booking_reference,
    customerName: b.customer_name,
    phone: b.phone,
    service: b.service,
    serviceKm: b.service_km,
    price: Number(b.price),
    durationMinutes: Number(b.duration_minutes),
    date: b.date,
    time: b.time,
    endTime: b.end_time,
    status: b.status
  }));
}

export async function logNotification(supabase, { bookingId, recipient, channel = 'telegram', message, status = 'sent' }) {
  try {
    await supabase.from('notifications').insert([
      {
        booking_id: bookingId ? String(bookingId) : null,
        recipient: String(recipient || 'admin'),
        channel,
        message,
        status,
        sent_at: new Date().toISOString()
      }
    ]);
  } catch (err) {
    console.warn('[Notification Logging Error]:', err.message);
  }
}
