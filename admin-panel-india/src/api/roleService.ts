import api from "./baseService";

export const roleService = {
  getFilterList: (params: { companyId: string }) =>
    api.get("/roles/filter-list", { params }),
};
