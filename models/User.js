const crypto = require('crypto');
const { supabase } = require('../config/supabase');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
}

const User = {
  hashPassword,
  verifyPassword,

  async findByEmail(email) {
    if (!email) return null;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: String(data.id),
      _id: String(data.id),
      email: data.email,
      passwordHash: data.password_hash,
      role: data.role,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  },

  async createUser({ email, password, role = 'admin' }) {
    const passwordHash = hashPassword(password);
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          email: email.trim().toLowerCase(),
          password_hash: passwordHash,
          role
        }
      ])
      .select()
      .single();

    if (error) throw new Error(`User creation failed: ${error.message}`);
    return {
      id: String(data.id),
      _id: String(data.id),
      email: data.email,
      role: data.role
    };
  },

  async updatePassword(email, newPassword) {
    if (!email || !newPassword) throw new Error('Email and new password are required');
    const passwordHash = hashPassword(newPassword);
    const { data, error } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      })
      .eq('email', email.trim().toLowerCase())
      .select()
      .single();

    if (error) throw new Error(`User password update failed: ${error.message}`);
    return {
      id: String(data.id),
      _id: String(data.id),
      email: data.email,
      role: data.role
    };
  },

  async countDocuments() {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    if (error) return 0;
    return count || 0;
  }
};

module.exports = User;
