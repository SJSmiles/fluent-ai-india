import api from "./baseService";

export const groupService = {
  getAll: (params?: { page?: number; limit?: number; name?: string; _id?: string; userId?: string }) =>
    api.get("/groups/listing", { params }),
  create: (data: { name: string; desc?: string; userId?: string; isArchived?: boolean }) =>
    api.post("/groups/create", data),
  update: (id: string, data: { name?: string; desc?: string; userId?: string; isArchived?: boolean }) =>
    api.put(`/groups/update/${id}`, data),
  delete: (id: string) => api.put(`/groups/update/${id}`, { isArchived: true }),
  getFilterList: (params?: { userId?: string }) =>
    api.get("/groups/filter-list", { params }),
};
