import api from "./baseService";

export const companyService = {
  getAll: () => api.get("/companies/listing"),
  getFilterListing: () => api.get("/companies/filter-listing"),
  getById: (id: string) => api.get(`/companies/${id}`),
  create: (data: any) => api.post("/companies/create", data),
  update: (id: string, data: any) => api.put(`/companies/update/${id}`, data),
  activate: (id: string) => api.patch(`/companies/${id}/activate`),
  deactivate: (id: string) => api.patch(`/companies/${id}/deactivate`),
};
