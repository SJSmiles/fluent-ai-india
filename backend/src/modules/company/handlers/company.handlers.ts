import { FastifyRequest, FastifyReply } from 'fastify';
import { CompanyService } from '../services/company.services';
import { throwError } from '../../../common/app-helper';
import { Server } from '../../../server';

const CompanyServiceInstance = new CompanyService();

interface QueryParams {
  skip?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
}

export async function createCompanyHandler(request: any, reply: FastifyReply) {
  try {
    Server.log.info(request.body, 'Create Company request payload');

    const user = request.user as any;
    const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;

    // Check if user belongs to super admin company OR is HSAdmin
    if (!user?.isAdmin && user?.companyId?.toString() !== SUPER_ADMIN_COMPANY_ID) {
      throw throwError('Access denied. Super admin privileges required.', { status: 403 }, 'REMOTE_FORBIDDEN');
    }

    const result = await CompanyServiceInstance.companyCreate(request.user, request.body);
    Server.log.info(result, 'Create Company response payload');

    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in createCompanyHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to create company'
    });
  }
}


export async function updateCompanyHandler(request: any, reply: FastifyReply) {
  try {
    Server.log.info(request.body, 'Update Company request payload');

    const user = request.user as any;
    const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;

    // Check if user belongs to super admin company OR is HSAdmin
    if (!user?.isHSAdmin && user?.companyId?.toString() !== SUPER_ADMIN_COMPANY_ID) {
      throw throwError('Access denied. Super admin privileges required.', { status: 403 }, 'REMOTE_FORBIDDEN');
    }

    const result = await CompanyServiceInstance.updateCompany(request.user, request.body);
    Server.log.info(result, 'Update Company response payload');

    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in updateCompanyHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to update company'
    });
  }
}

export async function getCompanyListHandler(
  request: FastifyRequest<{ Querystring: QueryParams }>,
  reply: FastifyReply
) {
  try {
    Server.log.info(request.query, 'Get Company List request');

    const user = request.user as any;
    const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;

    // Check if user belongs to super admin company OR is HSAdmin
    if (!user?.isHSAdmin && user?.companyId?.toString() !== SUPER_ADMIN_COMPANY_ID) {
      throw throwError('Access denied. Super admin privileges required.', { status: 403 }, 'REMOTE_FORBIDDEN');
    }

    const result = await CompanyServiceInstance.getCompanyList(request.query);

    Server.log.info(result, 'Get Company List response');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in getCompanyListHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to fetch companies'
    });
  }
}

export async function toggleCompanyStatusHandler(request: any, reply: FastifyReply) {
  try {
    Server.log.info(request.body, 'Toggle Company Status request payload');

    const user = request.user as any;
    const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;

    // Check if user belongs to super admin company OR is HSAdmin
    if (!user?.isHSAdmin && user?.companyId?.toString() !== SUPER_ADMIN_COMPANY_ID) {
      throw throwError('Access denied. Super admin privileges required.', { status: 403 }, 'REMOTE_FORBIDDEN');
    }

    const result = await CompanyServiceInstance.toggleCompanyStatus(request.user, request.body);
    Server.log.info(result, 'Toggle Company Status response payload');

    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in toggleCompanyStatusHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to toggle company status'
    });
  }
}

export async function getCompanyFilterListHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    Server.log.info('Get Company Filter List request');

    const user = request.user as any;
    const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;

    // Check if user is Super Admin
    const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

    if (!isSuperAdmin) {
      throw throwError('Access denied. Super admin privileges required.', { status: 403 }, 'REMOTE_FORBIDDEN');
    }

    const result = await CompanyServiceInstance.getCompanyFilterList();

    Server.log.info(result, 'Get Company Filter List response');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in getCompanyFilterListHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to fetch company filter list'
    });
  }
}