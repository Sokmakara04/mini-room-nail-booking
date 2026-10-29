const { supabase } = require('../config/supabase');

const DEFAULT_SERVICE_GROUPS = [
  {
    id: 'grp-basic-manicure',
    _id: 'grp-basic-manicure',
    name: 'Basic Manicure & Care',
    nameKm: 'ថែទាំនិងសម្អាតក្រចក',
    description: 'Essential fingernail care, cuticle trimming, shaping, hand and feet spa treatments.',
    descriptionKm: 'សេវាកម្មថែទាំនិងកាត់សម្អាតក្រចក ម៉ាស្សា និងស្ក្រាប់ដៃជើងបំប៉នសុខភាពក្រចក។',
    displayOrder: 1,
    isActive: true
  },
  {
    id: 'grp-gel-polish',
    _id: 'grp-gel-polish',
    name: 'Gel Polish',
    nameKm: 'លាបពណ៌ជែល',
    description: 'Solid gel, syrup gel, cat-eye, and French ombre gel polish treatments.',
    descriptionKm: 'លាបពណ៌ជែលម្សៅ ជែលថ្លា ជែលឆក់ និងម៉ូដ French / Ombre ភ្លឺរលោងជាប់បានយូរ។',
    displayOrder: 2,
    isActive: true
  },
  {
    id: 'grp-nail-extensions',
    _id: 'grp-nail-extensions',
    name: 'Nail Extensions & Overlay',
    nameKm: 'តនិងអប់ក្រចក',
    description: 'Full nail extensions, builder gel overlay, and flawless nail length enhancements.',
    descriptionKm: 'តប្រវែងក្រចកដៃដោយជែល អប់ជែល និងបិតក្រចកពេញដើម្បីរាងក្រចករឹងមាំស្រស់ស្អាត។',
    displayOrder: 3,
    isActive: true
  },
  {
    id: 'grp-nail-art',
    _id: 'grp-nail-art',
    name: 'Nail Art & Design',
    nameKm: 'ម៉ូដនិងសិល្បៈក្រចក',
    description: 'Custom hand-painted nail art, minimalist lines, 3D characters, flowers, and chrome isolation.',
    descriptionKm: 'គូរម៉ូដសិល្បៈក្រចកដៃ រចនាក្បាច់ 3D ផ្កាប៉ោង ត្រាស៊ីលីកូន និង Chrome ប្លែកទាន់សម័យ។',
    displayOrder: 4,
    isActive: true
  },
  {
    id: 'grp-nail-removal',
    _id: 'grp-nail-removal',
    name: 'Nail Removal',
    nameKm: 'ដោះក្រចកជែលនិងម្សៅ',
    description: 'Gentle and damage-free removal of gel polish, overlay, gel extensions, and acrylic nails.',
    descriptionKm: 'ដោះថ្នាំជែលចាស់ អប់ជែល តជែល និងម្សៅចេញដោយសុវត្ថិភាព មិនប៉ះពាល់ដល់ក្រចកធម្មជាតិ។',
    displayOrder: 5,
    isActive: true
  },
  {
    id: 'grp-nail-repair',
    _id: 'grp-nail-repair',
    name: 'Nail Repair & Maintenance',
    nameKm: 'ជួសជុលនិងថែទាំក្រចក',
    description: 'Fix broken fingernails, refills for gel extensions, overlays, and gel x maintenance.',
    descriptionKm: 'កែក្រចកបាក់ ឬខូច និងបំពេញបន្ថែម (Refill) សម្រាប់ក្រចកតជែល អប់ជែល និង Gel X។',
    displayOrder: 6,
    isActive: true
  },
  {
    id: 'grp-packages',
    _id: 'grp-packages',
    name: 'Packages & Promotions',
    nameKm: 'កញ្ចប់សេវាកម្មនិងប្រូម៉ូសិន',
    description: 'Bundled salon packages and special promotional offers.',
    descriptionKm: 'កញ្ចប់សេវាកម្មរួមបញ្ចូលគ្នា និងការផ្តល់ជូនពិសេសពីហាង។',
    displayOrder: 7,
    isActive: true
  }
];

// In-memory mapping of default services to groups
const DEFAULT_SERVICE_GROUP_MAP = {
  // Basic Manicure & Care (4 services)
  'svc-basic-manicure': 'grp-basic-manicure',
  'svc-french-manicure': 'grp-basic-manicure',
  'svc-nail-art': 'grp-basic-manicure',
  'svc-gel-removal': 'grp-basic-manicure',

  // Gel Polish (8 services)
  '60236ef2-ad10-49ca-b041-0ee8e28c0162': 'grp-gel-polish',
  'e2acd9e5-2647-4957-9523-daf9774678e0': 'grp-gel-polish',
  '33e6c177-2fb7-460f-9f64-2fe49fa4ed2c': 'grp-gel-polish',
  '19170834-aaf1-4200-806c-3db23a9940e0': 'grp-gel-polish',
  '194a630e-8e24-4239-b671-e73bf86ffc11': 'grp-gel-polish',
  'd6bb82c1-9070-4d11-ad33-1baf7855df3b': 'grp-gel-polish',
  '1efcd824-b98c-4de6-8d27-082de9c26673': 'grp-gel-polish',
  'ef101fac-5def-4f73-ad77-1ae3f4dae3f6': 'grp-gel-polish',

  // Nail Extensions & Overlay (3 services)
  'e1e41762-ddb4-4f01-8b14-4ca734eb9f44': 'grp-nail-extensions',
  'fe023eb3-db35-475a-8117-d6edd0512042': 'grp-nail-extensions',
  'bd0579e8-69b0-4dc8-9c11-b68640e576ea': 'grp-nail-extensions',

  // Nail Art & Design (7 services)
  '1e39448a-4442-4017-8e35-b401739439b5': 'grp-nail-art',
  '20456b73-fb5d-4260-b7b2-a0d564d3b25e': 'grp-nail-art',
  '736fc411-5fa6-408b-b9d1-1b8e93e719f8': 'grp-nail-art',
  '9806e376-4268-4269-af2b-0d7fb947b975': 'grp-nail-art',
  'd852cf7e-3dfe-494b-be8c-48907fe35bdf': 'grp-nail-art',
  'c4e1bdf9-b6c4-47da-8490-a228f6eeab53': 'grp-nail-art',
  '350d7db8-a610-4b72-b9bd-23db5cdbb8ad': 'grp-nail-art',

  // Nail Removal (4 services)
  'e59943b1-76a9-4af5-a77c-15d22cd89fda': 'grp-nail-removal',
  '221c1604-5651-4000-b56a-5c675c9da86c': 'grp-nail-removal',
  'd9c8be34-9419-4fc0-a861-511ad7830582': 'grp-nail-removal',
  '0c7f600f-d288-42aa-b2b5-c88e12f01c42': 'grp-nail-removal',

  // Nail Repair & Maintenance (4 services)
  'svc-gel-polish': 'grp-nail-repair',
  'ad47242f-8e78-489e-8e7d-8fb4cc08773d': 'grp-nail-repair',
  'cb690cea-0e0d-4fc3-abed-2d987294a344': 'grp-nail-repair',
  '0cdefb63-b4d5-4976-bc7d-fac991b89706': 'grp-nail-repair'
};

// In-memory runtime override store (keeps custom groups & overrides alive even before SQL migration)
let inMemoryGroups = [...DEFAULT_SERVICE_GROUPS.map(g => ({ ...g }))];
let inMemoryServiceGroupMap = { ...DEFAULT_SERVICE_GROUP_MAP };

function toCamelGroup(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    _id: String(row.id),
    name: row.name,
    nameKm: row.name_km || row.name,
    description: row.description || '',
    descriptionKm: row.description_km || '',
    displayOrder: Number(row.display_order ?? 0),
    isActive: Boolean(row.is_active ?? true),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const ServiceGroup = {
  DEFAULT_SERVICE_GROUPS,
  DEFAULT_SERVICE_GROUP_MAP,

  getAssignedGroupId(serviceId, serviceName = '') {
    if (inMemoryServiceGroupMap[serviceId]) {
      return inMemoryServiceGroupMap[serviceId];
    }
    // Keyword heuristics fallback
    const lower = (serviceName || '').toLowerCase();
    if (lower.includes('remove')) return 'grp-nail-removal';
    if (lower.includes('refill') || lower.includes('broken') || lower.includes('repair')) return 'grp-nail-repair';
    if (lower.includes('extension') || lower.includes('overlay') || lower.includes('បិតក្រចក')) return 'grp-nail-extensions';
    if (lower.includes('art') || lower.includes('design') || lower.includes('3d') || lower.includes('chrome')) return 'grp-nail-art';
    if (lower.includes('solid gel') || lower.includes('syrup') || lower.includes('cateye') || lower.includes('french')) return 'grp-gel-polish';
    return 'grp-basic-manicure';
  },

  setAssignedGroupId(serviceId, groupId) {
    inMemoryServiceGroupMap[serviceId] = groupId;
    try {
      const { setServiceGroupOverride } = require('../telegram-worker/src/db');
      if (typeof setServiceGroupOverride === 'function') {
        setServiceGroupOverride(serviceId, groupId);
      }
    } catch (e) {}
  },

  async find(filter = {}) {
    try {
      let query = supabase.from('service_groups').select('*').order('display_order', { ascending: true });
      if (filter.isActive !== undefined) {
        query = query.eq('is_active', Boolean(filter.isActive));
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map(toCamelGroup);
      }
    } catch (err) {
      // Supabase table not created yet or network failure, use fallback
    }

    // Fallback to in-memory groups
    let results = [...inMemoryGroups];
    if (filter.isActive !== undefined) {
      results = results.filter(g => g.isActive === Boolean(filter.isActive));
    }
    return results.sort((a, b) => a.displayOrder - b.displayOrder);
  },

  async findById(id) {
    if (!id) return null;
    const cleanId = String(id).trim();
    try {
      const { data, error } = await supabase
        .from('service_groups')
        .select('*')
        .eq('id', cleanId)
        .maybeSingle();

      if (!error && data) {
        return toCamelGroup(data);
      }
    } catch (err) {
      // Fallback
    }

    const found = inMemoryGroups.find(g => String(g.id) === cleanId);
    return found ? { ...found } : null;
  },

  async create(groupData) {
    const payload = {
      name: groupData.name.trim(),
      name_km: groupData.nameKm?.trim() || groupData.name.trim(),
      description: groupData.description?.trim() || '',
      description_km: groupData.descriptionKm?.trim() || '',
      display_order: Number(groupData.displayOrder || inMemoryGroups.length + 1),
      is_active: groupData.isActive !== undefined ? Boolean(groupData.isActive) : true
    };

    if (groupData.id) {
      payload.id = String(groupData.id).trim();
    } else {
      payload.id = 'grp-' + payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('grp-' + Date.now());
    }

    try {
      const { data, error } = await supabase
        .from('service_groups')
        .insert([payload])
        .select()
        .single();

      if (!error && data) {
        const camel = toCamelGroup(data);
        inMemoryGroups.push(camel);
        return camel;
      }
    } catch (err) {
      // Supabase table not created yet
    }

    // In-memory fallback
    const fallbackGroup = {
      id: payload.id,
      _id: payload.id,
      name: payload.name,
      nameKm: payload.name_km,
      description: payload.description,
      descriptionKm: payload.description_km,
      displayOrder: payload.display_order,
      isActive: payload.is_active,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    inMemoryGroups.push(fallbackGroup);
    return fallbackGroup;
  },

  async findByIdAndUpdate(id, updateData) {
    const cleanId = String(id).trim();
    const payload = {};
    if (updateData.name !== undefined) payload.name = updateData.name.trim();
    if (updateData.nameKm !== undefined) payload.name_km = updateData.nameKm.trim();
    if (updateData.description !== undefined) payload.description = updateData.description.trim();
    if (updateData.descriptionKm !== undefined) payload.description_km = updateData.descriptionKm.trim();
    if (updateData.displayOrder !== undefined) payload.display_order = Number(updateData.displayOrder);
    if (updateData.isActive !== undefined) payload.is_active = Boolean(updateData.isActive);

    try {
      const { data, error } = await supabase
        .from('service_groups')
        .update(payload)
        .eq('id', cleanId)
        .select()
        .single();

      if (!error && data) {
        const camel = toCamelGroup(data);
        const idx = inMemoryGroups.findIndex(g => String(g.id) === cleanId);
        if (idx !== -1) inMemoryGroups[idx] = camel;
        return camel;
      }
    } catch (err) {
      // Fallback
    }

    const idx = inMemoryGroups.findIndex(g => String(g.id) === cleanId);
    if (idx !== -1) {
      inMemoryGroups[idx] = {
        ...inMemoryGroups[idx],
        ...(payload.name !== undefined && { name: payload.name }),
        ...(payload.name_km !== undefined && { nameKm: payload.name_km }),
        ...(payload.description !== undefined && { description: payload.description }),
        ...(payload.description_km !== undefined && { descriptionKm: payload.description_km }),
        ...(payload.display_order !== undefined && { displayOrder: payload.display_order }),
        ...(payload.is_active !== undefined && { isActive: payload.is_active }),
        updatedAt: new Date().toISOString()
      };
      return { ...inMemoryGroups[idx] };
    }
    return null;
  },

  async toggleActive(id) {
    const group = await this.findById(id);
    if (!group) return null;
    return this.findByIdAndUpdate(id, { isActive: !group.isActive });
  }
};

module.exports = ServiceGroup;
