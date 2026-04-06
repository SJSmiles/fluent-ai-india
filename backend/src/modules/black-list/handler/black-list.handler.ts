import { FastifyRequest, FastifyReply } from "fastify";
import { Server } from '../../../server';
import { throwError } from '../../../common/app-helper';
import { BlackListService } from "../services/black-list.service";

export async function listBlackListHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = request.user as any;
    if (!user?.isAdmin) {
      throw throwError('Access denied. Only admin users can list blacklisted numbers.', { status: 403 });
    }

    const query = request.query;
    Server.log.info(query, 'List BlackList query params');

    const result = await BlackListService.listBlackList(request.user, query);
    return reply.send(result);
  } catch (error: any) {
    Server.log.error(error, 'Error in getCompanyListHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to fetch black listed numbers'
    });
  }
}

export async function removeBlackListHandler(request: any, reply: any) {
  try {
    const user = request.user as any;
    if (!user?.isAdmin) {
      throw throwError('Access denied. Only admin users can remove blacklisted numbers.', { status: 403 });
    }

    const result = await BlackListService.removeFromBlackList(request.user, request.params.id);
    return reply.send(result);
  } catch (error: any) {
    Server.log.error(error, 'Error in removeBlackListHandler');
    return reply.code(error?.status || error?.statusCode || 500).send({
      success: false,
      message: error?.message || 'Failed to remove number from blacklist'
    });
  }
}