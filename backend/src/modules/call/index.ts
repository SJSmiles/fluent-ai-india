import { AppModule } from '../../common/common-interfaces';
import {
  callDetailHandler,
  callListingHandler,
  exportCallListingHandler,
  groupedCallListingHandler,
  phoneDetailPostHandler,
  retellCallCreateHandler,
  retellCallListingHandler,
  updateCallLeadStatusHandler
} from './handler/call.handler';
import { createCommentHandler, listCommentsHandler, markAsReadHandler } from './handler/comment.handler';
import {
  callDetailRequest,
  callListingRequest,
  phoneDetailPostRequest,
  retellCallCreateRequest,
  updateCallLeadStatusRequest
} from './schema/call.schema';
import { createCommentRequest, listCommentsRequest, markAsReadRequest } from './schema/comment.schema';

export const module: AppModule = {
  name: 'Call module',
  mountPoint: '/calls',
  auth: true,
  routes: [
    {
      method: 'GET',
      url: '/retell-listing',
      auth: true,
      schema: callListingRequest,
      handler: retellCallListingHandler
    },

    {
      method: 'GET',
      url: '/listing',
      auth: true,
      schema: callListingRequest,
      handler: callListingHandler
    },
    {
      method: 'POST',
      url: '/phone-detail',
      auth: true,
      schema: phoneDetailPostRequest,
      handler: phoneDetailPostHandler
    },

    {
      method: 'GET',
      url: '/grouped-listing',
      auth: true,
      schema: callListingRequest,
      handler: groupedCallListingHandler
    },

    {
      method: 'GET',
      url: '/detail',
      auth: true,
      schema: callDetailRequest,
      handler: callDetailHandler
    },
    {
      method: 'GET',
      url: '/export',
      auth: true,
      schema: callListingRequest,
      handler: exportCallListingHandler
    },
    {
      method: 'POST',
      url: '/retell-create',
      auth: true,
      schema: retellCallCreateRequest,
      handler: retellCallCreateHandler
    },

    {
      method: 'PUT',
      url: '/update-leadStatus',
      auth: true,
      schema: updateCallLeadStatusRequest,
      handler: updateCallLeadStatusHandler
    },


    {
      method: 'POST',
      url: '/comments/create',
      auth: true,
      schema: createCommentRequest,
      handler: createCommentHandler
    },
    {
      method: 'GET',
      url: '/comments/list',
      auth: true,
      schema: listCommentsRequest,
      handler: listCommentsHandler
    },
    {
      method: 'PUT',
      url: '/comments/mark-read',
      auth: true,
      schema: markAsReadRequest,
      handler: markAsReadHandler
    }
  ]
};
