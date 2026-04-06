import { RequestSchemas } from '../../../common/common-interfaces';

export const loginRequest: RequestSchemas = {
  tags: ['User'],
  summary: 'Login User',
  description: `<h3> This API login User </h3>`,
  body: {
    title: 'User Login',
    type: 'object',
    additionalProperties: false,
    required: [],
    properties: {
      email: { type: 'string' },
      password: { type: 'string' }
    }
  }
};

export const getCurrentUserRequest: RequestSchemas = {
  tags: ['User'],
  summary: 'Get Current User',
  description: `<h3> This API gives Current User Detail </h3>`
};

export const refreshTokenRequest: RequestSchemas = {
  tags: ['Auth'],
  summary: 'Refresh Access Token',
  description: `<h3>Refresh access token using a valid refresh token</h3>`,
  body: {
    title: 'Refresh Token',
    additionalProperties: false,
    type: 'object',
    required: [],
    properties: {
      refreshToken: {
        type: 'string',
        description: 'JWT refresh token'
      }
    }
  }
};

export const listUserRequest: RequestSchemas = {
  tags: ['User'],
  summary: 'List all User',
  description: 'Fetch all User. Super admin can filter by companyId',
  schema: {
    querystring: {
      type: 'object',
      properties: {
        skip: { type: 'number', default: 0 },
        limit: { type: 'number', default: 10 },
        searchStr: { type: 'string', default: '' },
        sortBy: { type: 'string', default: '' },
        companyId: { type: 'string', description: 'Filter by company ID (Super Admin only)' }
      },
      required: []
    }
  }
};

export const filterListUserRequest: RequestSchemas = {
  tags: ['User'],
  summary: 'Get All Users (Filtered)',
  description: `<h3> This API retrieves users. Super Admin can filter by companyId. </h3>`,
  schema: {
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        companyId: {
          type: 'string',
          description: 'Optional: Super Admin can pass a companyId to get that company’s users.'
        }
      }
    }
  }
};

export const createUserRequest: RequestSchemas = {
  tags: ['User'],
  summary: 'Create New User',
  description: `<h3>This API creates a new user within the same company. SuperAdmin can create users for any company by providing companyId.</h3>`,
  body: {
    title: 'Create User',
    type: 'object',
    additionalProperties: false,
    required: ['firstName', 'lastName', 'email', 'password'],
    properties: {
      firstName: {
        type: 'string',
        minLength: 1,
        maxLength: 50,
        description: 'User first name'
      },
      lastName: {
        type: 'string',
        minLength: 1,
        maxLength: 50,
        description: 'User last name'
      },
      phoneNumber: {
        type: 'string',
        description: 'Mobile number (numbers only)'
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'Email address (must match company domain)'
      },
      password: {
        type: 'string',
        minLength: 6,
        description: 'User password'
      },
      status: {
        type: 'number',
        enum: [0, 1],
        default: 1,
        description: '0 = Inactive, 1 = Active'
      },
      companyId: {
        type: 'string',
        description: 'Target company ID (SuperAdmin only - optional)'
      },
      bmbyProjectId: {
        type: 'string',
        description: 'BMBY Project ID (optional)',
        default: ''
      },
      bmbyUserId: {
        type: 'string',
        description: 'BMBY User ID (optional)',
        default: ''
      },
      profileCompletion: {
        type: 'boolean',
        description: 'Profile completion status (auto-calculated based on BMBY fields)',
        default: true
      }
    }
  }
};

export const userRegistrationRequest: RequestSchemas = {
  tags: ['User'],
  summary: 'Registration User',
  description: `<h3> This API Registration User </h3>`,
  body: {
    title: 'User Registration',
    type: 'object',
    additionalProperties: false,
    required: ['email', 'password', 'confirmPassword'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: {
        type: 'string',
        minLength: 8,
        maxLength: 128
      },
      confirmPassword: {
        type: 'string',
        minLength: 8,
        maxLength: 128
      }
    }
  }
};

export const updateUserRequest: RequestSchemas = {
  tags: ['User'],
  summary: 'Update User',
  description: `<h3>This API updates user information (firstName, lastName, phoneNumber, status, BMBY fields)</h3>`,
  body: {
    title: 'Update User',
    type: 'object',
    additionalProperties: false,
    required: ['_id', 'firstName', 'lastName', 'phoneNumber', 'status'],
    properties: {
      _id: {
        type: 'string',
        description: 'User ID to update'
      },
      firstName: {
        type: 'string',
        minLength: 1,
        maxLength: 50,
        description: 'User first name'
      },
      lastName: {
        type: 'string',
        minLength: 1,
        maxLength: 50,
        description: 'User last name'
      },
      phoneNumber: {
        type: 'string',
        description: 'Phone number (numbers only)'
      },
      status: {
        type: 'number',
        enum: [0, 1],
        description: '0 = Inactive, 1 = Active'
      },
      // bmbyUserName: {
      //   type: 'string',
      //   description: 'BMBY Username (optional)'
      // },
      // bmbyPassword: {
      //   type: 'string',
      //   description: 'BMBY Password (optional)'
      // },
      bmbyProjectId: {
        type: 'string',
        description: 'BMBY Project ID (optional)'
      },
      bmbyUserId: {
        type: 'string',
        description: 'BMBY User ID (optional)'
      },
      profileCompletion: {
        type: 'boolean'
      }
    }
  }
};

export const toggleUserStatusRequest: RequestSchemas = {
  tags: ['User'],
  summary: 'Toggle User Status (Activate/Deactivate)',
  description: `<h3>This API activates or deactivates a user (Admin only)</h3>
  <p>Note: Users cannot be activated if their company is inactive.</p>`,
  body: {
    title: 'Toggle User Status',
    type: 'object',
    additionalProperties: false,
    required: ['_id', 'status'],
    properties: {
      _id: {
        type: 'string',
        description: 'User ID'
      },
      status: {
        type: 'number',
        enum: [0, 1],
        description: '0 = Inactive, 1 = Active'
      }
    }
  }
};

export const changePasswordRequest: RequestSchemas = {
  tags: ['User'],
  summary: 'Change User Password',
  description: `<h3> This API change user password</h3>`,
  body: {
    title: 'Change User Password',
    type: 'object',
    additionalProperties: false,
    required: ['_id', 'newPassword'],
    properties: {
      _id: { type: 'string' },
      currentPassword: { type: 'string' },
      newPassword: { type: 'string' }
    }
  }
};

export const createXSignatureKeyRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'XSignatureKey',
  description: `<h3>This API creates XSignatureKey for API authentication</h3>
    <p>Regular admins can only create keys for their own company users.</p>
    <p>Super admins can create keys for users from any company.</p>`,
  body: {
    title: 'XSignatureKey',
    type: 'object',
    additionalProperties: false,
    required: ['email', 'expiryTime'],
    properties: {
      email: { 
        type: 'string', 
        format: 'email',
        description: 'Email of the user for whom the API key is being created'
      },
      expiryTime: { 
        type: 'string',
        format: 'date-time',
        description: 'Expiry time in ISO 8601 format (must be a future date)'
      }
    }
  }
};

export const listXSignatureKeysRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'List XSignature Keys',
  description: `<h3>Fetch paginated list of XSignature API Keys</h3>
    <p>Regular admins can only view keys for their company.</p>
    <p>Super admins can view keys for all companies or filter by specific companyId.</p>`,
  schema: {
    querystring: {
      type: 'object',
      additionalProperties: false,
      properties: {
        companyId: { 
          type: 'string',
          description: 'Filter by company ID (optional for Super Admin, ignored for regular admin)'
        },
        skip: { 
          type: 'integer', 
          minimum: 0, 
          default: 0,
          description: 'Number of records to skip (for pagination)'
        },
        limit: { 
          type: 'integer', 
          minimum: 1,
          maximum: 100,
          default: 10,
          description: 'Number of records to return'
        },
        isActive: { 
          type: 'boolean', 
          description: 'Filter by active/inactive keys (optional)'
        },
        userEmail: { 
          type: 'string',
          description: 'Search by user email (optional)'
        },
        sortBy: {
          type: 'string',
          default: 'createdAt desc',
          description: 'Sort field and order, e.g. "createdAt desc" or "expiryTime asc"'
        }
      },
      required: [] // companyId is now optional
    }
  }
};

export const updateXSignatureKeyStatusRequest: RequestSchemas = {
  tags: ['Agent'],
  summary: 'Update XSignature Key Status',
  description: `<h3>Activate or deactivate an XSignature API Key</h3>
    <p>Regular admins can only update keys for their own company.</p>
    <p>Super admins can update keys for any company.</p>`,
  body: {
    title: 'UpdateXSignatureKeyStatus',
    type: 'object',
    additionalProperties: false,
    required: ['_id', 'isActive'],
    properties: {
      _id: { 
        type: 'string', 
        description: 'ID of the API key record to update' 
      },
      isActive: { 
        type: 'boolean', 
        description: 'Set to true to activate, false to deactivate' 
      }
    }
  }
};

