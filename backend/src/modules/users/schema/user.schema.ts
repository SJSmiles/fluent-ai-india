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
    required: ['_id', 'firstName', 'lastName', 'status'],
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
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address'
      },
      isAdmin: {
        type: 'boolean',
        description: 'Whether the user is an admin'
      },
      status: {
        type: 'number',
        enum: [0, 1],
        description: '0 = Inactive, 1 = Active'
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

