import api from "./baseService";

export const userService = {
  getCurrentUser: () => api.get("/users/getCurrentUser"),
  getAll: (params?: { page?: number; limit?: number; companyId?: string }) =>
    api.get("/users/listing", { params }),
  getFilterList: (params?: { companyId?: string }) =>
    api.get("/users/filter-list", { params }),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post("/users/create", data),
  update: (data: any) => api.put("/users/update", data),
  toggleStatus: (data: any) => api.put("/users/toggle-status", data),
  resetPassword: (data: any) => api.post("/users/change-password", data),
  delete: (id: string) => api.delete(`/users/${id}`),
};
