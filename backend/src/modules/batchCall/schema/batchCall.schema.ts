import { RequestSchemas } from '../../../common/common-interfaces';

export const createBatchCallRequest: RequestSchemas = {
  tags: ['Batch Call'],
  summary: 'Create Batch Call with Recipients Upload',
  description: 'Create a new batch call by uploading a CSV or XLSX file',
  consumes: ['multipart/form-data']
};
