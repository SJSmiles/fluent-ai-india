import { AppModule } from '../../common/common-interfaces';
import {
  createPhoneNumberHandler,
  deletePhoneNumberHandler,
  getPhoneNumberListHandler,
  updatePhoneNumberHandler,
  filterPhoneNumberListHandler
} from './handlers/phone-number.handlers';
import {
  createPhoneNumberRequest,
  deletePhoneNumberRequest,
  getPhoneNumberListRequest,
  updatePhoneNumberRequest,
  filterPhoneNumberListRequest
} from './schema/phone-number.schema';

export const module: AppModule = {
  name: 'Phone Number module',
  mountPoint: '/phone-number',
  auth: true,
  routes: [
    {
      method: 'POST',
      url: '/create',
      auth: true,
      schema: createPhoneNumberRequest,
      handler: createPhoneNumberHandler
    },
    {
      method: 'GET',
      url: '/listing',
      auth: true,
      schema: getPhoneNumberListRequest,
      handler: getPhoneNumberListHandler
    },
    {
      method: 'PUT',
      url: '/update',
      auth: true,
      schema: updatePhoneNumberRequest,
      handler: updatePhoneNumberHandler
    },
    {
      method: 'DELETE',
      url: '/delete',
      auth: true,
      schema: deletePhoneNumberRequest,
      handler: deletePhoneNumberHandler
    },
    {
      method: 'GET',
      url: '/filter-list',
      auth: true,
      schema: filterPhoneNumberListRequest,
      handler: filterPhoneNumberListHandler
    }
  ]
};
