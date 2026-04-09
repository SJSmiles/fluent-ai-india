import { AppModule } from '../../common/common-interfaces';

import {
  changePasswordRequest,
  createUserRequest,
  filterListUserRequest,
  getCurrentUserRequest,
  listUserRequest,
  loginRequest,
  refreshTokenRequest,
  toggleUserStatusRequest,
  updateUserRequest,
} from './schema/user.schema';
import {
  changePasswordHandler,
  createUserHandler,
  filterListUserHandler,
  getCurrentUserHandler,
  listUserHandler,
  loginHandler,
  refreshTokenHandler,
  toggleUserStatusHandler,
  updateUserHandler,
} from './handlers/user.handlers';

export const module: AppModule = {
  name: 'Users module',
  mountPoint: '/users',
  auth: true,
  routes: [
    {
      method: 'POST',
      url: '/login',
      auth: false,
      schema: loginRequest,
      handler: loginHandler
    },
    {
      method: 'GET',
      url: '/getCurrentUser',
      auth: false,
      schema: getCurrentUserRequest,
      handler: getCurrentUserHandler
    },

    {
      method: 'POST',
      url: '/refresh-token',
      auth: false,
      schema: refreshTokenRequest,
      handler: refreshTokenHandler
    },

    {
      method: 'GET',
      url: '/listing',
      auth: true,
      schema: listUserRequest,
      handler: listUserHandler
    },
    {
      method: 'GET',
      url: '/filter-list',
      auth: true,
      schema: filterListUserRequest,
      handler: filterListUserHandler
    },
    {
      method: 'POST',
      url: '/create',
      auth: true,
      schema: createUserRequest,
      handler: createUserHandler
    },
    {
      method: 'PUT',
      url: '/update',
      auth: true,
      schema: updateUserRequest,
      handler: updateUserHandler
    },

    {
      method: 'PUT',
      url: '/toggle-status',
      auth: true,
      schema: toggleUserStatusRequest,
      handler: toggleUserStatusHandler
    },
    {
      method: 'POST',
      url: '/change-password',
      auth: true,
      schema: changePasswordRequest,
      handler: changePasswordHandler
    }
  ]
};
