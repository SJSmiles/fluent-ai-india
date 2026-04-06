import { AppModule } from '../../common/common-interfaces';
import {
  createContactHandler,
  deleteContactHandler,
  exportContactListHandler,
  getContactListHandler,
  updateContactHandler,
  uploadContactsHandler
} from './handlers/contact.handlers';
import {
  createContactRequest,
  deleteContactRequest,
  exportContactListRequest,
  getContactListRequest,
  updateContactRequest,
  uploadContactsRequest
} from './schema/contact.schema';

export const module: AppModule = {
  name: 'Contact module',
  mountPoint: '/contacts',
  auth: true,
  routes: [
    {
      method: 'POST',
      url: '/upload',
      auth: true,
      schema: uploadContactsRequest,
      handler: uploadContactsHandler
    },
    {
      method: 'POST',
      url: '/create',
      auth: true,
      schema: createContactRequest,
      handler: createContactHandler
    },
    {
      method: 'GET',
      url: '/listing',
      auth: true,
      schema: getContactListRequest,
      handler: getContactListHandler
    },
    {
      method: 'PUT',
      url: '/update',
      auth: true,
      schema: updateContactRequest,
      handler: updateContactHandler
    },
    {
      method: 'DELETE',
      url: '/delete',
      auth: true,
      schema: deleteContactRequest,
      handler: deleteContactHandler
    },
    {
      method: 'GET',
      url: '/export',
      auth: true,
      schema: exportContactListRequest,
      handler: exportContactListHandler
    },
  ]
};