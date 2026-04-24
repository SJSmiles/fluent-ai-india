import api from "./baseService";

export const templateService = {
  getAll: (params?: { page?: number; limit?: number; name?: string; companyId?: string; type?: string }) =>
    api.get("/templates/listing", { params }),
  create: (data: { name: string; type: string; content: string; mediaUrl?: string; companyId: string; isFavorite?: boolean }) =>
    api.post("/templates/create", data),
  update: (id: string, data: { name?: string; type?: string; content?: string; mediaUrl?: string; isFavorite?: boolean }) =>
    api.put(`/templates/update/${id}`, data),
  delete: (id: string) => api.delete(`/templates/archive/${id}`),
  getFilterList: (params?: { companyId?: string }) => api.get('/templates/filter-list', { params }),
};
