import { AppModule } from '../../common/common-interfaces';

import {
  changePasswordRequest,
  createUserRequest,
  createXSignatureKeyRequest,
  filterListUserRequest,
  getCurrentUserRequest,
  listUserRequest,
  listXSignatureKeysRequest,
  loginRequest,
  refreshTokenRequest,
  toggleUserStatusRequest,
  updateUserRequest,
  updateXSignatureKeyStatusRequest,
  userRegistrationRequest
} from './schema/user.schema';
import {
  changePasswordHandler,
  createUserHandler,
  createXSignatureHandler,
  filterListUserHandler,
  getCurrentUserHandler,
  listUserHandler,
  listXSignatureKeysHandler,
  loginHandler,
  refreshTokenHandler,
  registrationUserHandler,
  toggleUserStatusHandler,
  updateUserHandler,
  updateXSignatureKeyStatusHandler
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
      method: 'POST',
      url: '/registration',
      auth: false,
      schema: userRegistrationRequest,
      handler: registrationUserHandler
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
    },
    {
      method: 'POST',
      url: '/x-signature',
      auth: true,
      schema: createXSignatureKeyRequest,
      handler: createXSignatureHandler
    },
    {
      method: 'GET',
      url: '/x-signature-list',
      auth: true,
      schema: listXSignatureKeysRequest,
      handler: listXSignatureKeysHandler
    },
    {
      method: 'POST',
      url: '/inactive-x-signature',
      auth: true,
      schema: updateXSignatureKeyStatusRequest,
      handler: updateXSignatureKeyStatusHandler
    }
  ]
};
