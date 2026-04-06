import { AppModule } from '../../common/common-interfaces';
import {
  createMessageTemplateHandler,
  deleteMessageTemplateHandler,
  getMessageTemplateListHandler,
  updateMessageTemplateHandler,
  updateStatusTemplateHandler,
  filterMessageTemplateListHandler,
  getMessageListHandler
} from './handlers/message-template.handlers';
import {
  createMessageTemplateRequest,
  deleteMessageTemplateRequest,
  getMessageTemplateListRequest,
  updateMessageTemplateRequest,
  updateStatusTemplateRequest,
  filterMessageTemplateListRequest,
  getMessageListRequest
} from './schema/message-template.schema';

export const module: AppModule = {
  name: 'Message Template module',
  mountPoint: '/message-templates',
  auth: true,
  routes: [
    {
      method: 'POST',
      url: '/create',
      auth: true,
      schema: createMessageTemplateRequest,
      handler: createMessageTemplateHandler
    },
    {
      method: 'GET',
      url: '/listing',
      auth: true,
      schema: getMessageTemplateListRequest,
      handler: getMessageTemplateListHandler
    },
    {
      method: 'PUT',
      url: '/update',
      auth: true,
      schema: updateMessageTemplateRequest,
      handler: updateMessageTemplateHandler
    },
    {
      method: 'DELETE',
      url: '/delete',
      auth: true,
      schema: deleteMessageTemplateRequest,
      handler: deleteMessageTemplateHandler
    },
    {
      method: 'PUT',
      url: '/change-status',
      auth: true,
      schema: updateStatusTemplateRequest,
      handler: updateStatusTemplateHandler
    },
    {
      method: 'GET',
      url: '/filter-list',
      auth: true,
      schema: filterMessageTemplateListRequest,
      handler: filterMessageTemplateListHandler
    },
    {
      method: 'GET',
      url: '/message-listing',
      auth: true,
      schema: getMessageListRequest,
      handler: getMessageListHandler
    }
  ]
};
