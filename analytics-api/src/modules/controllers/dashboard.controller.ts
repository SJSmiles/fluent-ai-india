import { FastifyReply, FastifyRequest } from 'fastify';
import { CALL_STATUS, DASHBOARD_ANALYTICS_TYPE } from '../../config/server-config';
import { AnalyticsService } from 'modules/services/dashboard.service';

export const dashboardHandler = async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    const { startDate, endDate, type, userId, statusFilter, agentId } = req.query as {
      startDate: string;
      endDate: string;
      type: number;
      userId: string;
      statusFilter?: string;
      agentId?: string;
    };

    if (type === DASHBOARD_ANALYTICS_TYPE.TOTAL_CALL) {
      return AnalyticsService.getTotalCallsStats(startDate, endDate, userId, agentId);
    }
    if (type === DASHBOARD_ANALYTICS_TYPE.TOTAL_DURATION) {
      return AnalyticsService.getDurationStats(startDate, endDate, userId, agentId);
    }
    if (type === DASHBOARD_ANALYTICS_TYPE.TOTAL_COST) {
      return AnalyticsService.getCostStats(startDate, endDate, userId, agentId);
    }
    if (type === DASHBOARD_ANALYTICS_TYPE.FAILED_CALLS) {
      return AnalyticsService.getStatusStats(startDate, endDate, [CALL_STATUS.FAILED, CALL_STATUS.ERROR], 'failed', userId, agentId);
    }
    if (type === DASHBOARD_ANALYTICS_TYPE.ENDED_CALLS) {
      return AnalyticsService.getStatusStats(startDate, endDate, [CALL_STATUS.ENDED], 'ended', userId, agentId);
    }
    if (type === DASHBOARD_ANALYTICS_TYPE.LEAD_STATUS) {
      return AnalyticsService.getLeadStatusStats(startDate, endDate, userId, statusFilter, agentId);
    }
    if (type === DASHBOARD_ANALYTICS_TYPE.CALL_PICKUP_STATUS) {
      return AnalyticsService.getCallPickupStatusStats(startDate, endDate, userId, agentId);
    }

    if (type === DASHBOARD_ANALYTICS_TYPE.TOTAL_ATTEMPTS) {
      return AnalyticsService.getTotalAttemptsStats(startDate, endDate, userId, agentId);
    }

    if (type === DASHBOARD_ANALYTICS_TYPE.ANSWERED_CALLS) {
      return AnalyticsService.getTotalAnsweredStats(startDate, endDate, userId, agentId);
    }

    if (type === DASHBOARD_ANALYTICS_TYPE.NO_ANSWER_CALLS) {
      return AnalyticsService.getTotalNoAnsweredStats(startDate, endDate, userId, agentId);
    }

    if (type === DASHBOARD_ANALYTICS_TYPE.AVG_DURATION) {
      return AnalyticsService.getAvgDurationStats(startDate, endDate, userId, agentId);
    }

    if (type === DASHBOARD_ANALYTICS_TYPE.SUCCESS_RATE) {
      return AnalyticsService.getSuccessStats(startDate, endDate, userId, agentId);
    }

    if (type === DASHBOARD_ANALYTICS_TYPE.LEAD_STATUS_DISTRIBUTION) {
      return AnalyticsService.getLeadStatusGroupStats(startDate, endDate, userId, agentId);
    }
  } catch (error) {
    console.error('Dashboard handler error:', error);
    return reply.status(500).send({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};