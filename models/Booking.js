const { supabase } = require('../config/supabase');

function generateBookingReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'NL-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function toCamelBooking(row) {
  if (!row) return null;
  const b = {
    id: String(row.id),
    _id: String(row.id),
    bookingReference: row.booking_reference,
    customerName: row.customer_name,
    phone: row.phone,
    serviceId: row.service_id ? String(row.service_id) : '',
    service: row.service,
    serviceKm: row.service_km || '',
    price: Number(row.price),
    durationMinutes: Number(row.duration_minutes),
    date: row.date,
    time: row.time,
    endTime: row.end_time,
    notes: row.notes || '',
    adminNotes: row.admin_notes || '',
    telegramId: row.telegram_id || '',
    source: row.source || 'website',
    language: row.language || 'en',
    status: row.status || 'pending',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  b.save = async function () {
    const payload = {
      customer_name: this.customerName,
      phone: this.phone,
      service_id: this.serviceId || null,
      service: this.service,
      service_km: this.serviceKm,
      price: this.price,
      duration_minutes: this.durationMinutes,
      date: this.date,
      time: this.time,
      end_time: this.endTime,
      notes: this.notes,
      admin_notes: this.adminNotes,
      telegram_id: this.telegramId,
      source: this.source,
      language: this.language,
      status: this.status
    };

    const { data, error } = await supabase
      .from('bookings')
      .update(payload)
      .eq('id', this.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update booking #${this.bookingReference}: ${error.message}`);
    }
    return toCamelBooking(data);
  };

  return b;
}

class BookingQuery {
  constructor(filter = {}) {
    this.filter = filter;
    this.sortFields = [];
    this.limitCount = null;
  }

  sort(sortObj) {
    if (sortObj) {
      for (const [key, dir] of Object.entries(sortObj)) {
        let dbCol = 'created_at';
        if (key === 'date') dbCol = 'date';
        else if (key === 'time') dbCol = 'time';
        else if (key === 'createdAt') dbCol = 'created_at';
        else if (key === 'status') dbCol = 'status';
        this.sortFields.push({ column: dbCol, ascending: dir !== -1 });
      }
    }
    return this;
  }

  limit(n) {
    this.limitCount = n;
    return this;
  }

  lean() {
    return this.exec();
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  async exec() {
    let query = supabase.from('bookings').select('*');

    // Date filter
    if (this.filter.date) {
      query = query.eq('date', this.filter.date);
    }

    // Status filter
    if (this.filter.status) {
      if (typeof this.filter.status === 'object' && this.filter.status.$in) {
        query = query.in('status', this.filter.status.$in);
      } else if (typeof this.filter.status === 'string') {
        query = query.eq('status', this.filter.status);
      }
    }

    // ID exclusion ($ne)
    const excludeId = this.filter._id?.$ne || this.filter.id?.$ne;
    if (excludeId) {
      query = query.neq('id', String(excludeId));
    }

    // Direct bookingReference match
    if (this.filter.bookingReference && typeof this.filter.bookingReference === 'string') {
      query = query.eq('booking_reference', this.filter.bookingReference);
    }

    // Direct phone match
    if (this.filter.phone && typeof this.filter.phone === 'string') {
      query = query.eq('phone', this.filter.phone);
    }

    // $or searches (Admin search, Status lookup, Telegram bot search)
    if (Array.isArray(this.filter.$or) && this.filter.$or.length > 0) {
      const orParts = [];
      for (const condition of this.filter.$or) {
        if (condition.bookingReference) {
          const raw = condition.bookingReference.$regex ? condition.bookingReference.$regex.source || String(condition.bookingReference.$regex) : String(condition.bookingReference);
          const clean = raw.replace(/^\^|\$$|\\/g, '');
          orParts.push(`booking_reference.ilike.%${clean}%`);
        }
        if (condition.phone) {
          const raw = condition.phone.$regex ? condition.phone.$regex.source || String(condition.phone.$regex) : String(condition.phone);
          const clean = raw.replace(/^\^|\$$|\\/g, '');
          orParts.push(`phone.ilike.%${clean}%`);
        }
        if (condition.customerName) {
          const raw = condition.customerName.$regex ? condition.customerName.$regex.source || String(condition.customerName.$regex) : String(condition.customerName);
          const clean = raw.replace(/^\^|\$$|\\/g, '');
          orParts.push(`customer_name.ilike.%${clean}%`);
        }
      }
      if (orParts.length > 0) {
        query = query.or(orParts.join(','));
      }
    }

    // Sorting
    if (this.sortFields.length > 0) {
      for (const s of this.sortFields) {
        query = query.order(s.column, { ascending: s.ascending });
      }
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Limiting
    if (this.limitCount) {
      query = query.limit(this.limitCount);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[Supabase Error] Booking.find failed:', error.message);
      return [];
    }

    return (data || []).map(toCamelBooking);
  }
}

const Booking = {
  find(filter = {}) {
    return new BookingQuery(filter);
  },

  async findById(id) {
    if (!id) return null;
    const cleanId = String(id).trim();
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', cleanId)
      .maybeSingle();

    if (error || !data) return null;
    return toCamelBooking(data);
  },

  async findOne(filter = {}) {
    let query = supabase.from('bookings').select('*').limit(1);

    if (filter.bookingReference) {
      query = query.eq('booking_reference', filter.bookingReference);
    }
    if (filter.customerName) {
      query = query.eq('customer_name', filter.customerName);
    }
    if (filter.phone) {
      query = query.eq('phone', filter.phone);
    }
    if (filter.date) {
      query = query.eq('date', filter.date);
    }
    if (filter.id || filter._id) {
      query = query.eq('id', String(filter.id || filter._id));
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;
    return toCamelBooking(data[0]);
  },

  async create(bookingData) {
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
      telegram_id: (bookingData.telegramId || '').trim(),
      source: bookingData.source || 'website',
      language: bookingData.language || 'en',
      status: bookingData.status || 'pending'
    };

    if (bookingData.id || bookingData._id) {
      payload.id = String(bookingData.id || bookingData._id);
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert([payload])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create booking in Supabase: ${error.message}`);
    }

    return toCamelBooking(data);
  },

  async countDocuments(filter = {}) {
    let query = supabase.from('bookings').select('*', { count: 'exact', head: true });

    if (filter.date) {
      query = query.eq('date', filter.date);
    }
    if (filter.status) {
      query = query.eq('status', filter.status);
    }

    const { count, error } = await query;
    if (error) {
      console.error('[Supabase Error] countDocuments bookings:', error.message);
      return 0;
    }
    return count || 0;
  },

  async deleteMany(filter = {}) {
    let query = supabase.from('bookings').delete();

    if (filter.date) {
      query = query.eq('date', filter.date);
    }
    if (filter.customerName) {
      query = query.eq('customer_name', filter.customerName);
    }
    if (filter.phone) {
      query = query.eq('phone', filter.phone);
    }

    const { data, error } = await query.select();
    if (error) {
      console.error('[Supabase Error] deleteMany bookings:', error.message);
      return { deletedCount: 0 };
    }
    return { deletedCount: data ? data.length : 0 };
  }
};

module.exports = Booking;
