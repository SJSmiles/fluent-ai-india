import api from "./baseService";

export const agentService = {
  getAll: (params?: { page?: number; limit?: number; companyId?: string }) =>
    api.get("/agents/listing", { params }),
  filterListing: (params?: any) => api.get("/agents/filter-list", { params }),
  getById: (id: string) => api.get(`/agents/${id}`),
  create: (data: any) => api.post("/agents/create", data),
  update: (id: string, data: any) => api.put(`/agents/update/${id}`, data),
  delete: (id: string) => api.delete(`/agents/${id}`),
  setPrimary: (id: string) => api.post(`/agents/${id}/set-primary`, {}),
  downloadSample: () => api.get("/agents/download-sample", { responseType: 'blob' }),
  makeCall: (data: { agentId: string; phoneNumber: string; toPhoneNumber: string; userId?: string; metadata?: any }) =>
    api.post("/agents/make-call", data),
};
