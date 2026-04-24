import api from './baseService';

export const resourceService = {
    upload: async (file: File, path: string = 'templates/') => {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await api.post(`/resources/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                'x-file-path': path
            }
        });
        return response.data; // { success: true, message: '...', response: "filename" }
    },

    getSignedUrl: async (fileName: string) => {
        const response = await api.get(`/resources/get-url`, {
            params: { fileName }
        });
        return response.data; // { success: true, message: '...', response: "url" }
    },

    getBlob: async (fileName: string, filePath: string = '') => {
        const response = await api.get(`/resources/get-blob`, {
            params: { fileName, filePath },
            responseType: 'blob'
        });
        return response.data; // This will be the Blob
    }
};
