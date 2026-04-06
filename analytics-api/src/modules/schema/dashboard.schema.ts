import { RequestSchemas } from "../../common/common.interface";

export const dashboardCountRequest: RequestSchemas = {
  tags: ['Dashboard'],
  summary: 'Dashboard Analytics Count',
  description: `<h3> Dashboard Analytics Count</h3>`,
  schema: {
    querystring: {
      type: 'object',
      required: ['startDate', 'endDate', 'type'],
      properties: {
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        type: { type: 'integer', minimum: 1, maximum: 13 },
        statusFilter: { type: 'string' }
      }
    }
  }
};