export const DEFAULT_TIMEZONE = 'Asia/Phnom_Penh';

export function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(totalMins) {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function calculateEndTime(startTimeStr, durationMinutes) {
  const startMins = timeToMinutes(startTimeStr);
  const endMins = startMins + Number(durationMinutes || 45);
  return minutesToTime(endMins);
}

export function intervalsOverlap(startA, endA, startB, endB) {
  const a1 = timeToMinutes(startA);
  const a2 = timeToMinutes(endA);
  const b1 = timeToMinutes(startB);
  const b2 = timeToMinutes(endB);
  return a1 < b2 && b1 < a2;
}

export function getLocalToday(timeZone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const get = type => parts.find(p => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function getLocalCurrentTime(timeZone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date());

  const get = type => parts.find(p => p.type === type)?.value;
  return `${get('hour')}:${get('minute')}`;
}

export function getDayOfWeek(dateStr) {
  // YYYY-MM-DD to day of week: 0 = Sun, 1 = Mon ... 6 = Sat
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return date.getUTCDay();
}

export function isDateWorkingDay(dateStr, settings, timeZone = DEFAULT_TIMEZONE) {
  const today = getLocalToday(timeZone);
  if (dateStr < today) return { ok: false, reason: 'past_date' };

  if (Array.isArray(settings.daysOff) && settings.daysOff.includes(dateStr)) {
    return { ok: false, reason: 'day_off' };
  }

  const dow = getDayOfWeek(dateStr);
  if (Array.isArray(settings.workingDays) && !settings.workingDays.includes(dow)) {
    return { ok: false, reason: 'closed_day' };
  }

  return { ok: true };
}

export async function getAvailableSlots(supabase, dateStr, durationMinutes, settings, timeZone = DEFAULT_TIMEZONE) {
  const check = isDateWorkingDay(dateStr, settings, timeZone);
  if (!check.ok) return [];

  const duration = Number(durationMinutes) || 45;
  const interval = Number(settings.slotIntervalMinutes) || 30;
  const openMins = timeToMinutes(settings.openingTime || '09:00');
  const closeMins = timeToMinutes(settings.closingTime || '19:00');
  const maxCapacity = Number(settings.maxConcurrentStaff) || 2;

  const today = getLocalToday(timeZone);
  const currentTime = getLocalCurrentTime(timeZone);
  const isToday = dateStr === today;

  // Retrieve existing pending & confirmed bookings for this date from Supabase
  const { data: activeBookings, error } = await supabase
    .from('bookings')
    .select('time, end_time, duration_minutes')
    .eq('date', dateStr)
    .in('status', ['pending', 'confirmed']);

  if (error) {
    console.error('[Scheduler Supabase Error]:', error.message);
  }

  const existing = activeBookings || [];
  const slots = [];

  for (let m = openMins; m + duration <= closeMins; m += interval) {
    const slotStart = minutesToTime(m);
    const slotEnd = minutesToTime(m + duration);

    // If booking for today, slot must be in the future (minimum 30 mins lead time)
    if (isToday) {
      const minStartMins = timeToMinutes(currentTime) + 30;
      if (m < minStartMins) continue;
    }

    // Check if slot overlaps with salon break time
    if (settings.breakStart && settings.breakEnd) {
      if (intervalsOverlap(slotStart, slotEnd, settings.breakStart, settings.breakEnd)) {
        continue;
      }
    }

    // Count concurrent overlapping bookings
    let concurrentCount = 0;
    for (const b of existing) {
      const bStart = b.time;
      const bEnd = b.end_time || calculateEndTime(b.time, b.duration_minutes);
      if (intervalsOverlap(slotStart, slotEnd, bStart, bEnd)) {
        concurrentCount++;
      }
    }

    if (concurrentCount < maxCapacity) {
      slots.push({
        time: slotStart,
        endTime: slotEnd,
        availableCapacity: maxCapacity - concurrentCount
      });
    }
  }

  return slots;
}

export async function checkSlotAvailability(
  supabase,
  dateStr,
  startTimeStr,
  durationMinutes,
  settings,
  excludeBookingId = null,
  timeZone = DEFAULT_TIMEZONE
) {
  const check = isDateWorkingDay(dateStr, settings, timeZone);
  if (!check.ok) {
    return { available: false, reason: check.reason };
  }

  const duration = Number(durationMinutes) || 45;
  const startMins = timeToMinutes(startTimeStr);
  const endMins = startMins + duration;
  const endTimeStr = minutesToTime(endMins);

  const openMins = timeToMinutes(settings.openingTime || '09:00');
  const closeMins = timeToMinutes(settings.closingTime || '19:00');
  const maxCapacity = Number(settings.maxConcurrentStaff) || 2;

  if (startMins < openMins || endMins > closeMins) {
    return { available: false, reason: 'outside_operating_hours' };
  }

  const today = getLocalToday(timeZone);
  const currentTime = getLocalCurrentTime(timeZone);
  if (dateStr === today) {
    const minStartMins = timeToMinutes(currentTime) + 15;
    if (startMins < minStartMins) {
      return { available: false, reason: 'slot_in_past' };
    }
  }

  if (settings.breakStart && settings.breakEnd) {
    if (intervalsOverlap(startTimeStr, endTimeStr, settings.breakStart, settings.breakEnd)) {
      return { available: false, reason: 'salon_break_time' };
    }
  }

  let query = supabase
    .from('bookings')
    .select('id, time, end_time, duration_minutes')
    .eq('date', dateStr)
    .in('status', ['pending', 'confirmed']);

  if (excludeBookingId) {
    query = query.neq('id', String(excludeBookingId));
  }

  const { data: bookings, error } = await query;
  if (error) {
    console.error('[CheckSlot Supabase Error]:', error.message);
  }

  let concurrentCount = 0;
  for (const b of (bookings || [])) {
    const bStart = b.time;
    const bEnd = b.end_time || calculateEndTime(b.time, b.duration_minutes);
    if (intervalsOverlap(startTimeStr, endTimeStr, bStart, bEnd)) {
      concurrentCount++;
    }
  }

  if (concurrentCount >= maxCapacity) {
    return { available: false, reason: 'station_capacity_full' };
  }

  return { available: true, endTime: endTimeStr };
}
