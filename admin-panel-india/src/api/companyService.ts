import api from "./baseService";

export const companyService = {
  getAll: (params?: any) => api.get("/companies/listing", { params }),
  getFilterListing: () => api.get("/companies/company-filter-list"),
  getById: (id: string) => api.get(`/companies/${id}`),
  create: (data: any) => api.post("/companies/create", data),
  update: (data: any) => api.put("/companies/update", data),
  toggleStatus: (data: { _id: string; isActive: boolean }) => api.put("/companies/toggle-status", data),
};
