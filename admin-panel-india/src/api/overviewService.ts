import api from './baseService';

export const overviewService = {
    get: () => api.get('/overview'),
};
