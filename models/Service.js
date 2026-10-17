const { supabase } = require('../config/supabase');

function toCamelService(row) {
  if (!row) return null;
  const s = {
    id: String(row.id),
    _id: String(row.id),
    name: row.name,
    nameKm: row.name_km,
    price: Number(row.price),
    durationMinutes: Number(row.duration_minutes),
    description: row.description || '',
    descriptionKm: row.description_km || '',
    imageUrl: row.image_url || '',
    category: row.category || 'fingernail',
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  s.save = async function () {
    const { data, error } = await supabase
      .from('services')
      .update({
        name: this.name,
        name_km: this.nameKm,
        price: this.price,
        duration_minutes: this.durationMinutes,
        description: this.description,
        description_km: this.descriptionKm,
        image_url: this.imageUrl,
        category: this.category,
        is_active: this.isActive
      })
      .eq('id', this.id)
      .select()
      .single();

    if (error) throw new Error(`Service update failed: ${error.message}`);
    return toCamelService(data);
  };

  return s;
}

class ServiceQuery {
  constructor(filter = {}) {
    this.filter = filter;
    this.sortField = null;
    this.sortAsc = true;
    this.limitCount = null;
  }

  sort(sortObj) {
    if (sortObj) {
      const field = Object.keys(sortObj)[0];
      if (field) {
        this.sortField = field === 'price' ? 'price' : field === 'name' ? 'name' : 'created_at';
        this.sortAsc = sortObj[field] !== -1;
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
    let query = supabase.from('services').select('*');

    if (this.filter.isActive !== undefined) {
      query = query.eq('is_active', Boolean(this.filter.isActive));
    }
    if (this.filter.category) {
      query = query.eq('category', this.filter.category);
    }
    if (this.filter.name) {
      query = query.eq('name', this.filter.name);
    }

    if (this.sortField) {
      query = query.order(this.sortField, { ascending: this.sortAsc });
    } else {
      query = query.order('created_at', { ascending: true });
    }

    if (this.limitCount) {
      query = query.limit(this.limitCount);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[Supabase Error] Service.find failed:', error.message);
      return [];
    }

    return (data || []).map(toCamelService);
  }
}

const Service = {
  find(filter = {}) {
    return new ServiceQuery(filter);
  },

  async findOne(filter = {}) {
    let query = supabase.from('services').select('*').limit(1);
    if (filter.name) query = query.eq('name', filter.name);
    if (filter.id) query = query.eq('id', filter.id);
    if (filter._id) query = query.eq('id', filter._id);
    if (filter.isActive !== undefined) query = query.eq('is_active', Boolean(filter.isActive));

    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;
    return toCamelService(data[0]);
  },

  async findById(id) {
    if (!id) return null;
    const cleanId = String(id).trim();
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', cleanId)
      .maybeSingle();

    if (error || !data) return null;
    return toCamelService(data);
  },

  async create(serviceData) {
    const payload = {
      name: serviceData.name.trim(),
      name_km: serviceData.nameKm?.trim() || serviceData.name.trim(),
      price: Number(serviceData.price),
      duration_minutes: Number(serviceData.durationMinutes || 45),
      description: serviceData.description?.trim() || '',
      description_km: serviceData.descriptionKm?.trim() || '',
      image_url: serviceData.imageUrl?.trim() || '',
      category: serviceData.category || 'fingernail',
      is_active: serviceData.isActive !== undefined ? Boolean(serviceData.isActive) : true
    };

    if (serviceData.id || serviceData._id) {
      payload.id = String(serviceData.id || serviceData._id);
    }

    const { data, error } = await supabase
      .from('services')
      .insert([payload])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create service in Supabase: ${error.message}`);
    }
    return toCamelService(data);
  },

  async findByIdAndUpdate(id, updateData) {
    const payload = {};
    if (updateData.name !== undefined) payload.name = updateData.name.trim();
    if (updateData.nameKm !== undefined) payload.name_km = updateData.nameKm.trim();
    if (updateData.price !== undefined) payload.price = Number(updateData.price);
    if (updateData.durationMinutes !== undefined) payload.duration_minutes = Number(updateData.durationMinutes);
    if (updateData.description !== undefined) payload.description = updateData.description.trim();
    if (updateData.descriptionKm !== undefined) payload.description_km = updateData.descriptionKm.trim();
    if (updateData.imageUrl !== undefined) payload.image_url = updateData.imageUrl.trim();
    if (updateData.category !== undefined) payload.category = updateData.category;
    if (updateData.isActive !== undefined) payload.is_active = Boolean(updateData.isActive);

    const { data, error } = await supabase
      .from('services')
      .update(payload)
      .eq('id', String(id))
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to update service in Supabase: ${error.message}`);
    }
    return toCamelService(data);
  },

  async findByIdAndDelete(id) {
    const { data, error } = await supabase
      .from('services')
      .delete()
      .eq('id', String(id))
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to delete service from Supabase: ${error.message}`);
    }
    return toCamelService(data);
  },

  async countDocuments(filter = {}) {
    let query = supabase.from('services').select('*', { count: 'exact', head: true });
    if (filter.isActive !== undefined) query = query.eq('is_active', Boolean(filter.isActive));
    if (filter.category) query = query.eq('category', filter.category);

    const { count, error } = await query;
    if (error) {
      console.error('[Supabase Error] countDocuments services:', error.message);
      return 0;
    }
    return count || 0;
  },

  async seedDefaults() {
    const count = await this.countDocuments();
    if (count === 0) {
      const defaults = [
        {
          name: 'Basic Manicure',
          nameKm: 'កាត់និងសម្អាតក្រចកដៃមូលដ្ឋាន',
          price: 12,
          durationMinutes: 35,
          description: 'Nail shaping, cuticle trimming, gentle buffing, and nourishing hand massage.',
          descriptionKm: 'កាត់តម្រឹមរាងក្រចក សម្អាតគល់ក្រចក និងម៉ាស្សាបាតដៃយ៉ាងទន់ភ្លន់។',
          imageUrl: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=600&q=80',
          isActive: true
        },
        {
          name: 'Gel Nail Polish',
          nameKm: 'លាបថ្នាំជែលក្រចកដៃ',
          price: 20,
          durationMinutes: 45,
          description: 'Long-lasting premium gel polish with high-gloss shine and UV-LED cure.',
          descriptionKm: 'លាបថ្នាំជែលជាប់បានយូរ ភ្លឺរលោងស្អាត និងស្ងួតឆាប់រហ័សដោយពន្លឺ UV-LED។',
          imageUrl: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=600&q=80',
          isActive: true
        },
        {
          name: 'Nail Art Design',
          nameKm: 'គូរម៉ូដសិល្បៈក្រចកដៃ',
          price: 28,
          durationMinutes: 60,
          description: 'Custom creative hand-painted nail art, minimalist lines, chrome, or glitter finish.',
          descriptionKm: 'គូរម៉ូដសិល្បៈក្រចកដៃតាមចំណូលចិត្ត ក្បាច់រចនាស្អាតប្លែក និងទាន់សម័យ។',
          imageUrl: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=600&q=80',
          isActive: true
        },
        {
          name: 'Nail Extensions (Gel / Acrylic)',
          nameKm: 'តក្រចកដៃ (ជែល ឬ អាគ្រីលីក)',
          price: 38,
          durationMinutes: 75,
          description: 'Full set fingernail extensions to add length and strength with flawless shaping.',
          descriptionKm: 'តប្រវែងក្រចកដៃឱ្យស្រស់ស្អាត រឹងមាំ និងរាងសមសួនទាក់ទាញ។',
          imageUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80',
          isActive: true
        },
        {
          name: 'Gel Removal & Care',
          nameKm: 'ដោះជែលនិងថែបំប៉នក្រចកដៃ',
          price: 10,
          durationMinutes: 25,
          description: 'Gentle, damage-free gel polish removal followed by cuticle oil and keratin strengthener.',
          descriptionKm: 'ដោះថ្នាំជែលចាស់ចេញដោយមិនប៉ះពាល់ក្រចក រួមជាមួយការបំប៉នប្រេងខេរ៉ាទីន។',
          imageUrl: 'https://images.unsplash.com/photo-1599839575945-a9e5af0c3fa5?auto=format&fit=crop&w=600&q=80',
          isActive: true
        },
        {
          name: 'French Manicure Tips',
          nameKm: 'ម៉ូដក្រចកបារាំង (French Manicure)',
          price: 24,
          durationMinutes: 50,
          description: 'Timeless classic French tips manicure with natural pink base and crisp white edges.',
          descriptionKm: 'រចនាបែបបារាំងបុរាណ គល់ផ្កាឈូកធម្មជាតិ និងចុងក្រចកពណ៌សយ៉ាងផ្ចិតផ្ចង់។',
          imageUrl: 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=600&q=80',
          isActive: true
        }
      ];

      for (const d of defaults) {
        await this.create(d);
      }
      console.log('[Supabase Database] Pre-seeded 6 default fingernail services.');
    }
  }
};

module.exports = Service;
