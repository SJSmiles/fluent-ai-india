import api from './baseService';

export const campaignService = {
    create: async (payload: any) => {
        const response = await api.post(`/campaigns/create`, payload);
        return response.data;
    },

    getAll: async (params: any = {}) => {
        const response = await api.get(`/campaigns/listing`, { params });
        return response.data;
    },

    getLogs: async (id: string) => {
        const response = await api.get(`/campaigns/${id}/logs`);
        return response.data;
    }
};
