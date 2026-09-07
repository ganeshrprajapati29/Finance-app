import api from '../api/axios.js';

export async function getPublicOverview() {
  try {
    const response = await api.get('/public/overview');
    return response.data?.data || null;
  } catch {
    return null;
  }
}

export async function submitPublicContact(payload) {
  try {
    const response = await api.post('/public/contact', payload);
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || 'Unable to send message right now';
    throw new Error(message);
  }
}
