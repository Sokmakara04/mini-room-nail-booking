import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// DATABASE HELPER LAYER (Supabase via REST on Cloudflare Workers)
// ==============================================================================

export function getSupabase(env) {
  const url = (env.SUPABASE_URL || '').trim();
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY || '').trim();
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export const DEFAULT_BOT_GROUPS = [
  { id: 'grp-basic-manicure', name: 'Basic Manicure & Care', nameKm: 'ថែទាំនិងសម្អាតក្រចក', displayOrder: 1, isActive: true },
  { id: 'grp-gel-polish', name: 'Gel Polish', nameKm: 'លាបពណ៌ជែល', displayOrder: 2, isActive: true },
  { id: 'grp-nail-extensions', name: 'Nail Extensions & Overlay', nameKm: 'តនិងអប់ក្រចក', displayOrder: 3, isActive: true },
  { id: 'grp-nail-art', name: 'Nail Art & Design', nameKm: 'ម៉ូដនិងសិល្បៈក្រចក', displayOrder: 4, isActive: true },
  { id: 'grp-nail-removal', name: 'Nail Removal', nameKm: 'ដោះក្រចកជែលនិងម្សៅ', displayOrder: 5, isActive: true },
  { id: 'grp-nail-repair', name: 'Nail Repair & Maintenance', nameKm: 'ជួសជុលនិងថែទាំក្រចក', displayOrder: 6, isActive: true },
  { id: 'grp-packages', name: 'Packages & Promotions', nameKm: 'កញ្ចប់សេវាកម្មនិងប្រូម៉ូសិន', displayOrder: 7, isActive: true }
];

export const DEFAULT_BOT_SERVICE_MAP = {
  'svc-basic-manicure': 'grp-basic-manicure',
  'svc-french-manicure': 'grp-basic-manicure',
  'svc-nail-art': 'grp-basic-manicure',
  'svc-gel-removal': 'grp-basic-manicure',
  '60236ef2-ad10-49ca-b041-0ee8e28c0162': 'grp-gel-polish',
  'e2acd9e5-2647-4957-9523-daf9774678e0': 'grp-gel-polish',
  '33e6c177-2fb7-460f-9f64-2fe49fa4ed2c': 'grp-gel-polish',
  '19170834-aaf1-4200-806c-3db23a9940e0': 'grp-gel-polish',
  '194a630e-8e24-4239-b671-e73bf86ffc11': 'grp-gel-polish',
  'd6bb82c1-9070-4d11-ad33-1baf7855df3b': 'grp-gel-polish',
  '1efcd824-b98c-4de6-8d27-082de9c26673': 'grp-gel-polish',
  'ef101fac-5def-4f73-ad77-1ae3f4dae3f6': 'grp-gel-polish',
  'e1e41762-ddb4-4f01-8b14-4ca734eb9f44': 'grp-nail-extensions',
  'fe023eb3-db35-475a-8117-d6edd0512042': 'grp-nail-extensions',
  'bd0579e8-69b0-4dc8-9c11-b68640e576ea': 'grp-nail-extensions',
  '1e39448a-4442-4017-8e35-b401739439b5': 'grp-nail-art',
  '20456b73-fb5d-4260-b7b2-a0d564d3b25e': 'grp-nail-art',
  '736fc411-5fa6-408b-b9d1-1b8e93e719f8': 'grp-nail-art',
  '9806e376-4268-4269-af2b-0d7fb947b975': 'grp-nail-art',
  'd852cf7e-3dfe-494b-be8c-48907fe35bdf': 'grp-nail-art',
  'c4e1bdf9-b6c4-47da-8490-a228f6eeab53': 'grp-nail-art',
  '350d7db8-a610-4b72-b9bd-23db5cdbb8ad': 'grp-nail-art',
  'e59943b1-76a9-4af5-a77c-15d22cd89fda': 'grp-nail-removal',
  '221c1604-5651-4000-b56a-5c675c9da86c': 'grp-nail-removal',
  'd9c8be34-9419-4fc0-a861-511ad7830582': 'grp-nail-removal',
  '0c7f600f-d288-42aa-b2b5-c88e12f01c42': 'grp-nail-removal',
  'svc-gel-polish': 'grp-nail-repair',
  'ad47242f-8e78-489e-8e7d-8fb4cc08773d': 'grp-nail-repair',
  'cb690cea-0e0d-4fc3-abed-2d987294a344': 'grp-nail-repair',
  '0cdefb63-b4d5-4976-bc7d-fac991b89706': 'grp-nail-repair'
};

let runtimeServiceGroupOverrides = {};

export function setServiceGroupOverride(serviceId, groupId) {
  if (serviceId) {
    runtimeServiceGroupOverrides[String(serviceId)] = String(groupId);
  }
}

export function resolveServiceGroupId(s) {
  if (s.group_id) return String(s.group_id);
  const id = String(s.id);
  if (runtimeServiceGroupOverrides[id]) return runtimeServiceGroupOverrides[id];
  if (DEFAULT_BOT_SERVICE_MAP[id]) return DEFAULT_BOT_SERVICE_MAP[id];
  const name = (s.name || '').toLowerCase();
  if (name.includes('remove')) return 'grp-nail-removal';
  if (name.includes('refill') || name.includes('repair') || name.includes('broken')) return 'grp-nail-repair';
  if (name.includes('extension') || name.includes('overlay') || name.includes('បិតក្រចក')) return 'grp-nail-extensions';
  if (name.includes('art') || name.includes('design') || name.includes('3d') || name.includes('chrome')) return 'grp-nail-art';
  if (name.includes('solid gel') || name.includes('syrup') || name.includes('cateye') || name.includes('french')) return 'grp-gel-polish';
  return 'grp-basic-manicure';
}

export async function getActiveServiceGroups(supabase) {
  try {
    const { data, error } = await supabase
      .from('service_groups')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map(g => ({
        id: String(g.id),
        name: g.name,
        nameKm: g.name_km || g.name,
        description: g.description || '',
        descriptionKm: g.description_km || '',
        displayOrder: Number(g.display_order ?? 0),
        isActive: Boolean(g.is_active ?? true)
      }));
    }
  } catch (err) {}
  return DEFAULT_BOT_GROUPS.filter(g => g.isActive);
}

export async function getServiceGroupById(supabase, groupId) {
  const cleanId = String(groupId).trim();
  try {
    const { data, error } = await supabase
      .from('service_groups')
      .select('*')
      .eq('id', cleanId)
      .maybeSingle();

    if (!error && data) {
      return {
        id: String(data.id),
        name: data.name,
        nameKm: data.name_km || data.name,
        description: data.description || '',
        descriptionKm: data.description_km || '',
        displayOrder: Number(data.display_order ?? 0),
        isActive: Boolean(data.is_active ?? true)
      };
    }
  } catch (err) {}

  const fallback = DEFAULT_BOT_GROUPS.find(g => g.id === cleanId);
  return fallback || null;
}

export async function isServiceAndGroupActive(supabase, serviceId) {
  if (!serviceId) return { valid: false, reason: 'service_not_found', service: null, group: null };
  const service = await getServiceById(supabase, serviceId);
  if (!service || !service.isActive) {
    return { valid: false, reason: 'service_inactive', service: null, group: null };
  }
  if (service.groupId) {
    const group = await getServiceGroupById(supabase, service.groupId);
    if (group && !group.isActive) {
      return { valid: false, reason: 'group_inactive', service, group };
    }
    return { valid: true, service, group };
  }
  return { valid: true, service, group: null };
}

export async function getSalonSettings(supabase, fallbackName = 'Mini Room Nail & Eyelash') {
  const { data, error } = await supabase
    .from('salon_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return {
      salonName: fallbackName,
      salonPhone: '012345678',
      openingTime: '09:00',
      closingTime: '19:00',
      slotIntervalMinutes: 30,
      daysOff: [],
      maxConcurrentStaff: 2
    };
  }

  const row = data;
  return {
    salonName: row.salon_name || fallbackName,
    salonPhone: row.salon_phone || '012345678',
    openingTime: row.opening_time || '09:00',
    closingTime: row.closing_time || '19:00',
    slotIntervalMinutes: Number(row.slot_interval_minutes || 30),
    daysOff: Array.isArray(row.days_off) ? row.days_off : [],
    maxConcurrentStaff: Number(row.max_concurrent_staff || 2)
  };
}

export async function getActiveServices(supabase, groupId = null) {
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

  let mapped = (data || []).map(s => ({
    _id: String(s.id),
    id: String(s.id),
    name: s.name,
    nameKm: s.name_km,
    price: Number(s.price),
    durationMinutes: Number(s.duration_minutes),
    description: s.description || '',
    descriptionKm: s.description_km || '',
    isActive: s.is_active,
    category: s.category,
    groupId: resolveServiceGroupId(s)
  }));

  if (groupId) {
    mapped = mapped.filter(s => String(s.groupId) === String(groupId));
  }

  return mapped;
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
    category: data.category,
    groupId: resolveServiceGroupId(data)
  };
}

export async function createBooking(supabase, bookingData) {
  const payload = {
    booking_reference: bookingData.bookingReference,
    customer_name: bookingData.customerName,
    phone: bookingData.phone,
    service: bookingData.service,
    service_km: bookingData.serviceKm,
    service_id: bookingData.serviceId,
    price: Number(bookingData.price || 0),
    duration_minutes: Number(bookingData.durationMinutes || 45),
    date: bookingData.date,
    time: bookingData.time,
    end_time: bookingData.endTime,
    status: 'pending',
    notes: bookingData.notes || '',
    telegram_id: bookingData.telegramId ? String(bookingData.telegramId) : null,
    source: 'telegram'
  };

  const { data, error } = await supabase
    .from('bookings')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('[Supabase createBooking Error]:', error.message);
    throw new Error(error.message);
  }

  return {
    _id: String(data.id),
    id: String(data.id),
    bookingReference: data.booking_reference,
    customerName: data.customer_name,
    phone: data.phone,
    service: data.service,
    serviceKm: data.service_km,
    serviceId: data.service_id,
    price: Number(data.price),
    durationMinutes: Number(data.duration_minutes),
    date: data.date,
    time: data.time,
    endTime: data.end_time,
    status: data.status,
    notes: data.notes || '',
    telegramId: data.telegram_id,
    source: data.source
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
    service: data.service,
    serviceKm: data.service_km,
    price: Number(data.price),
    durationMinutes: Number(data.duration_minutes),
    date: data.date,
    time: data.time,
    endTime: data.end_time,
    status: data.status,
    notes: data.notes || '',
    telegramId: data.telegram_id,
    source: data.source
  };
}

export async function findBookingByReference(supabase, ref) {
  if (!ref) return null;
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('booking_reference', ref.trim().toUpperCase())
    .maybeSingle();

  if (error || !data) return null;
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
    status: data.status,
    notes: data.notes || '',
    telegramId: data.telegram_id,
    source: data.source
  };
}

export async function findBookingsByQuery(supabase, query) {
  if (!query) return [];
  const clean = String(query).trim();

  let q = supabase.from('bookings').select('*');
  if (/^\d+$/.test(clean)) {
    q = q.or(`telegram_id.eq.${clean},phone.ilike.%${clean}%`);
  } else {
    q = q.or(`booking_reference.eq.${clean.toUpperCase()},customer_name.ilike.%${clean}%`);
  }

  const { data, error } = await q.order('date', { ascending: false }).limit(5);
  if (error) {
    console.error('[Supabase findBookingsByQuery Error]:', error.message);
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
    status: b.status,
    telegramId: b.telegram_id
  }));
}

export async function updateBookingStatus(supabase, id, newStatus) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: newStatus })
    .eq('id', String(id))
    .select()
    .maybeSingle();

  if (error) {
    console.error('[Supabase updateBookingStatus Error]:', error.message);
    throw new Error(error.message);
  }

  if (!data) return null;
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
    status: data.status,
    telegramId: data.telegram_id,
    source: data.source
  };
}

export async function findBookingsForDate(supabase, dateStr) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('date', dateStr)
    .neq('status', 'cancelled');

  if (error) {
    console.error('[Supabase findBookingsForDate Error]:', error.message);
    return [];
  }

  return (data || []).map(b => ({
    time: b.time,
    endTime: b.end_time,
    status: b.status
  }));
}

export async function logNotification(supabase, notifData) {
  try {
    await supabase.from('notifications').insert([{
      booking_id: notifData.bookingId,
      recipient: String(notifData.recipient),
      channel: notifData.channel || 'telegram',
      message: notifData.message,
      status: notifData.status || 'sent'
    }]);
  } catch (err) {
    console.error('[Supabase logNotification Error]:', err?.message || err);
  }
}
