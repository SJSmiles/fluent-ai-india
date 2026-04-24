import api from "./baseService";

// Add these to deviceService.ts or a new webjsService.ts
export const webjsService = {
  startSession: (deviceId: string) =>
    api.get(`/webjs/session/start/${deviceId}`),
  getQRImage: (deviceId: string) =>
    api.get(`/webjs/session/qr/${deviceId}/image`),
};
