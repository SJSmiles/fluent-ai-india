import api from './baseService';

export const deviceService = {
  create: (data: any) => api.post('/devices/create', data),
  getAll: (params?: any) => api.get('/devices/listing', { params }),
  getById: (id: string) => api.get(`/devices/${id}`),
  update: (id: string, data: any) => api.put(`/devices/update/${id}`, data),
  delete: (id: string) => api.delete(`/devices/${id}`),
  generateQR: (id: string) => api.post(`/devices/${id}/generate-qr`),
  getStatus: (id: string) => api.get(`/devices/${id}/status`),
  sendMessage: (id: string, data: { phoneNumber: string; message: string }) => api.post(`/devices/${id}/send-message`, data),
  logout: (id: string) => api.post(`/devices/${id}/logout`),
  getFilterList: (params?: { userId?: string }) => api.get('/devices/filter-list', { params }),
};
