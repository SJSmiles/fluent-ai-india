import { AppModule } from '../../common/common-interfaces';
import { createCompanyHandler, generateCompanyTokenHandler, getCompanyFilterListHandler, getCompanyListHandler, getCountryMasterListHandler, toggleCompanyStatusHandler, updateCompanyHandler } from './handlers/company.handlers';
import { createCompanyRequest, generateCompanyTokenRequest, getCompanyFilterListRequest, getCompanyListRequest, getCountryMasterListRequest, toggleCompanyStatusRequest, updateCompanyRequest } from './schema/company.schema';

export const module: AppModule = {
  name: 'Company module',
  mountPoint: '/companies',
  auth: true,
  routes: [
    {
      method: 'POST',
      url: '/create',
      auth: true,
      schema: createCompanyRequest,
      handler: createCompanyHandler
    },
    {
      method: 'GET',
      url: '/listing',
      auth: true,
      schema: getCompanyListRequest,
      handler: getCompanyListHandler
    },
    {
      method: 'PUT',
      url: '/update',
      auth: true,
      schema: updateCompanyRequest,
      handler: updateCompanyHandler
    },
    {
      method: 'PUT',
      url: '/toggle-status',
      auth: true,
      schema: toggleCompanyStatusRequest,
      handler: toggleCompanyStatusHandler
    },
    {
      method: 'GET',
      url: '/country-master-list',
      auth: true,
      schema: getCountryMasterListRequest,
      handler: getCountryMasterListHandler
    },
    {
      method: 'GET',
      url: '/company-filter-list',
      auth: true,
      schema: getCompanyFilterListRequest,
      handler: getCompanyFilterListHandler
    },
    {
      method: 'POST',
      url: '/generate-token',
      auth: true,
      schema: generateCompanyTokenRequest,
      handler: generateCompanyTokenHandler
    }
  ]
};
