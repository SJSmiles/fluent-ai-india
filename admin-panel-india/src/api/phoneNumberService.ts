import api from './baseService';

export const phoneNumberService = {
    listing: (params?: any) => api.get('/phone-number/listing', { params }),
    filterListing: (params?: any) => api.get('/phone-number/filter-list', { params }),
    create: (data: any) => api.post('/phone-number/create', data),
    update: (data: any) => api.put('/phone-number/update', data),
};
