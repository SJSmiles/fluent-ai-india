import api from './baseService';

export const authService = {
    login: (credentials: any) => api.post('/users/login', credentials),
    logout: () => api.post('/users/logout'),
    changePassword: (data: any) => api.post('/users/change-password', data),
};
