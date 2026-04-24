import api from "./baseService";

export const contactService = {
  getAll: (params?: { page?: number; limit?: number; name?: string; groupId?: string }) =>
    api.get("/contacts/listing", { params }),
  create: (data: { name: string; email?: string; phoneNumber: string; groupId: string }) =>
    api.post("/contacts/create", data),
  update: (id: string, data: { name?: string; email?: string; phoneNumber?: string; groupId?: string }) =>
    api.put(`/contacts/update/${id}`, data),
  delete: (id: string) => api.delete(`/contacts/archive/${id}`),
  downloadSample: () => api.get("/contacts/download-sample", { responseType: "blob" }),
  importExcel: (formData: FormData) => api.post("/contacts/import-excel", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  }),
  importPreview: (formData: FormData) => api.post("/contacts/import-preview", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  }),
};
