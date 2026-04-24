import api from './baseService';

export const batchCallService = {
    listing: (params?: any) => api.get('/batch-call/listing', { params }),
    create: (formData: FormData) => api.post('/batch-call/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    startCall: (id: string, payload: any) => api.put(`/batch-call/start-call/${id}`, payload),
    deleteCall: (id: string, type: string) => api.delete(`/batch-call/delete/${id}/${type}`),
    retryBatch: (payload: any) => api.post('/batch-call/retry-batch-call', payload),
    retryFollowups: (payload: any) => api.post('/batch-call/retry-followups-batch-call', payload),
    filterListing: (params?: any) => api.get('/batch-call/batch-listing', { params }),
    updateBatchCall: (payload: any) => api.post('/batch-call/retry-batch-call', payload),
    updateFollowupCall: (payload: any) => api.post('/batch-call/retry-followups-batch-call', payload),
};
