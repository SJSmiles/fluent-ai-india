import { RequestSchemas } from '../../../common/common-interfaces';

export const uploadContactsRequest: RequestSchemas = {
  tags: ['Contact'],
  summary: 'Bulk Upload Contacts',
  description: `<h3>This API uploads contacts in bulk from Excel file (.xlsx, .xls)</h3>
  <p><strong>Expected Excel columns (Required):</strong></p>
  <ul>
    <li>phone_number (required) - International format recommended (e.g., +918769365375)</li>
    <li>first_name (required) - If blank, will be auto-extracted from email</li>
    <li>client_id (required) - bmbyId numeric value</li>
    <li>email (required)</li>
  </ul>
  <p><strong>Optional columns:</strong></p>
  <ul>
    <li>last_name (optional)</li>
    <li>gender (optional: masculine/feminine/neuter)</li>
    <li>salutation (optional: Herr/Frau)</li>
    <li>country (optional)</li>
  </ul>
  <p><strong>Response includes:</strong></p>
  <ul>
    <li>Total records processed</li>
    <li>Success count</li>
    <li>Failed count</li>
    <li>Error report download (base64 buffer) if any errors</li>
  </ul>
  <p><strong>Note:</strong> If first_name is blank/empty, it will be automatically extracted from email address (part before @).</p>
  <p><strong>Access:</strong> All contacts are created under the authenticated user's account</p>`,
  consumes: ['multipart/form-data']
};

export const createContactRequest: RequestSchemas = {
  tags: ['Contact'],
  summary: 'Create Contact',
  description: `<h3> This API creates a new contact </h3>
  <p><strong>Required fields:</strong> bmbyId (client_id), email, number</p>
  <p><strong>Note:</strong> If firstName is blank/empty, it will be auto-extracted from email</p>
  <p><strong>Access:</strong> Contact is created under the authenticated user's account</p>`,
  body: {
    title: 'Contact create',
    type: 'object',
    additionalProperties: false,
    required: ['bmbyId', 'email', 'number'], // ✅ firstName not required in schema (handled in service)
    properties: {
      bmbyId: {
        type: 'number',
        description: 'Client ID (required)'
      },
      number: {
        type: 'string',
        pattern: '^[0-9+\\-\\s()]+$',
        minLength: 10,
        maxLength: 20,
        description: 'Phone number (required)'
      },
      salutation: {
        type: 'string',
        enum: ['Herr', 'Frau', '']
      },
      firstName: {
        type: 'string',
        description: 'First name (if blank, extracted from email)'
      },
      lastName: {
        type: 'string',
        description: 'Last name (optional)'
      },
      gender: {
        type: 'string',
        enum: ['masculine', 'feminine', 'neuter', '']
      },
      email: {
        type: 'string',
        format: 'email',
        maxLength: 100,
        description: 'Email (required)'
      },
      country: { type: 'string' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            companyId: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string' },
            number: { type: 'string' },
            bmbyId: { type: 'number' }
          }
        }
      }
    }
  }
};

export const getContactListRequest: RequestSchemas = {
  tags: ['Contact'],
  summary: 'Get Contact List',
  description: `<h3> This API returns list of contacts </h3>
  <p><strong>Access Rules:</strong></p>
  <ul>
    <li><strong>Regular Users:</strong> Can only see their own contacts (filtered by createdBy)</li>
    <li><strong>Admin/Super Admin:</strong> By default see their own contacts. Can pass userId query param to view specific user's contacts</li>
  </ul>`,
  schema: {
    querystring: {
      type: 'object',
      properties: {
        skip: { type: 'number', default: 0 },
        limit: { type: 'number', default: 10 },
        search: { type: 'string' },
        sortBy: { type: 'string', default: 'createdAt' },
        isActive: { type: 'boolean' },
        userId: { type: 'string', description: 'Optional: Admin can pass userId to view specific user contacts' }
      }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            contacts: { type: 'array' },
            total: { type: 'number' },
            skip: { type: 'number' },
            limit: { type: 'number' }
          }
        }
      }
    }
  }
};

export const updateContactRequest: RequestSchemas = {
  tags: ['Contact'],
  summary: 'Update Contact',
  description: `<h3> This API updates contact information </h3>
  <p><strong>Note:</strong> If firstName is blank/empty, it will be auto-extracted from email</p>
  <p><strong>Access:</strong> Users can only update their own contacts. Admins can update any contact in their company</p>`,
  body: {
    title: 'Contact update',
    type: 'object',
    additionalProperties: false,
    required: ['_id'],
    properties: {
      _id: { type: 'string' },
      bmbyId: { type: 'number' },
      number: {
        type: 'string',
        pattern: '^[0-9+\\-\\s()]+$',
        minLength: 10,
        maxLength: 20
      },
      salutation: {
        type: 'string',
        enum: ['Herr', 'Frau', '']
      },
      firstName: {
        type: 'string',
        description: 'First name (if blank, extracted from email)'
      },
      lastName: {
        type: 'string',
        description: 'Last name (optional)'
      },
      gender: {
        type: 'string',
        enum: ['masculine', 'feminine', 'neuter', '']
      },
      email: {
        type: 'string',
        format: 'email',
        maxLength: 100
      },
      country: { type: 'string' },
      isActive: { type: 'boolean' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object'
        }
      }
    }
  }
};

export const deleteContactRequest: RequestSchemas = {
  tags: ['Contact'],
  summary: 'Delete Contact (Soft Delete)',
  description: `<h3> This API soft deletes a contact by setting isArchived to true </h3>
  <p><strong>Access:</strong> Users can only delete their own contacts. Admins can delete any contact in their company</p>`,
  body: {
    title: 'Contact delete',
    type: 'object',
    additionalProperties: false,
    required: ['_id'],
    properties: {
      _id: {
        type: 'string',
        description: 'Contact ID'
      }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  }
};


export const exportContactListRequest: RequestSchemas = {
  tags: ['Contact'],
  summary: 'Export Contact List',
  description: `<h3> This API returns list of contacts exports</h3>
  <p><strong>Access Rules:</strong></p>
  <ul>
    <li><strong>Regular Users:</strong> Can only see their own contacts (filtered by createdBy)</li>
    <li><strong>Admin/Super Admin:</strong> By default see their own contacts. Can pass userId query param to view specific user's contacts</li>
  </ul>`,
  schema: {
    querystring: {
      type: 'object',
      properties: {
        search: { type: 'string' },
        sortBy: { type: 'string', default: 'createdAt' },
        isActive: { type: 'boolean' },
        userId: { type: 'string', description: 'Optional: Admin can pass userId to view specific user contacts' },
        timezone: { type: 'string', description: 'Client timezone in IANA format' }
      }
    }
  }
};