import api from './baseService';

export const blacklistService = {
    listing: (params?: any) => api.get('/black-list/listing', { params }),
    unBlacklist: (id: string) => api.put(`/black-list/un-black-list/${id}`),
};
