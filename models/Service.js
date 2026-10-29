const { supabase } = require('../config/supabase');
const ServiceGroup = require('./ServiceGroup');

function toCamelService(row) {
  if (!row) return null;
  const serviceId = String(row.id);
  const groupId = row.group_id
    ? String(row.group_id)
    : ServiceGroup.getAssignedGroupId(serviceId, row.name);

  const s = {
    id: serviceId,
    _id: serviceId,
    name: row.name,
    nameKm: row.name_km,
    price: Number(row.price),
    durationMinutes: Number(row.duration_minutes),
    description: row.description || '',
    descriptionKm: row.description_km || '',
    imageUrl: row.image_url || '',
    category: row.category || 'fingernail',
    groupId: groupId,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  s.save = async function () {
    const updateObj = {
      name: this.name,
      name_km: this.nameKm,
      price: this.price,
      duration_minutes: this.durationMinutes,
      description: this.description,
      description_km: this.descriptionKm,
      image_url: this.imageUrl,
      category: this.category,
      is_active: this.isActive
    };

    if (this.groupId) {
      updateObj.group_id = this.groupId;
      ServiceGroup.setAssignedGroupId(this.id, this.groupId);
    }

    try {
      const { data, error } = await supabase
        .from('services')
        .update(updateObj)
        .eq('id', this.id)
        .select()
        .single();

      if (!error && data) {
        return toCamelService(data);
      }
      if (error && error.message.includes('group_id')) {
        // Column group_id not yet created in Supabase schema
        delete updateObj.group_id;
        const retry = await supabase
          .from('services')
          .update(updateObj)
          .eq('id', this.id)
          .select()
          .single();
        if (retry.error) throw new Error(`Service update failed: ${retry.error.message}`);
        return toCamelService(retry.data);
      }
      if (error) throw new Error(`Service update failed: ${error.message}`);
    } catch (err) {
      throw err;
    }

    return this;
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

    let results = (data || []).map(toCamelService);

    if (this.filter.groupId) {
      results = results.filter(s => String(s.groupId) === String(this.filter.groupId));
    }

    return results;
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

    if (serviceData.groupId) {
      payload.group_id = String(serviceData.groupId);
    }

    try {
      const { data, error } = await supabase
        .from('services')
        .insert([payload])
        .select()
        .single();

      if (!error && data) {
        if (serviceData.groupId) {
          ServiceGroup.setAssignedGroupId(String(data.id), serviceData.groupId);
        }
        return toCamelService(data);
      }

      if (error && error.message.includes('group_id')) {
        delete payload.group_id;
        const retry = await supabase
          .from('services')
          .insert([payload])
          .select()
          .single();
        if (retry.error) throw new Error(`Failed to create service in Supabase: ${retry.error.message}`);
        if (serviceData.groupId) {
          ServiceGroup.setAssignedGroupId(String(retry.data.id), serviceData.groupId);
        }
        return toCamelService(retry.data);
      }
      if (error) throw new Error(`Failed to create service in Supabase: ${error.message}`);
    } catch (err) {
      throw err;
    }
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
    if (updateData.groupId !== undefined) {
      payload.group_id = updateData.groupId ? String(updateData.groupId) : null;
      ServiceGroup.setAssignedGroupId(String(id), updateData.groupId);
    }

    try {
      const { data, error } = await supabase
        .from('services')
        .update(payload)
        .eq('id', String(id))
        .select()
        .maybeSingle();

      if (!error && data) {
        return toCamelService(data);
      }

      if (error && error.message.includes('group_id')) {
        delete payload.group_id;
        const retry = await supabase
          .from('services')
          .update(payload)
          .eq('id', String(id))
          .select()
          .maybeSingle();
        if (retry.error) throw new Error(`Failed to update service in Supabase: ${retry.error.message}`);
        return toCamelService(retry.data);
      }
      if (error) throw new Error(`Failed to update service in Supabase: ${error.message}`);
    } catch (err) {
      throw err;
    }
  },

  async moveToGroup(serviceId, groupId) {
    ServiceGroup.setAssignedGroupId(String(serviceId), groupId);
    return this.findByIdAndUpdate(serviceId, { groupId });
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
  }
};

module.exports = Service;
