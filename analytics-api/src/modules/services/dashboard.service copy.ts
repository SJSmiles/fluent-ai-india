import { Call } from '../models/call.model';
import { getComparisonRanges } from '../../helper/dateHelper';
import { DASHBOARD_ANALYTICS_TYPE, CALL_STATUS, LEAD_STATUS } from '../../config/server-config';
import { Types } from 'mongoose';

export class AnalyticsService {
  public static async getAnalytics(
    startDate: string,
    endDate: string,
    type: number,
    statusCodes?: number[],
    fieldKey?: string,
    selectedUserId?: string,
    statusFilter?: string
  ) {
    const { currentRange, previousRange } = getComparisonRanges(startDate, endDate);

    const aggregate = [
      {
        $match: {
          createdAt: {
            $gt: previousRange.start,
            $lte: currentRange.end
          },
          createdBy: new Types.ObjectId(selectedUserId)
        }
      },
      {
        $facet: {
          current: [
            {
              $match: {
                createdAt: {
                  $gt: currentRange.start,
                  $lte: currentRange.end
                },
                createdBy: new Types.ObjectId(selectedUserId)
              }
            }
          ],
          previous: [
            {
              $match: {
                createdAt: {
                  $gt: previousRange.start,
                  $lte: previousRange.end
                },
                createdBy: new Types.ObjectId(selectedUserId)
              }
            }
          ]
        }
      }
    ];

    switch (type) {
      case 1:
        this.totalCallsGroup(aggregate);
        break;
      case 2:
        this.durationGroup(aggregate);
        break;
      case 3:
        this.costGroup(aggregate);
        break;
      case 4:
      case 5:
        if (statusCodes != null && fieldKey) {
          this.statusStatsGroup(aggregate, statusCodes);
        } else {
          throw new Error('Missing statusCodes or fieldKey for status analytics');
        }
        break;
      case 6:
        this.leadStatusGroup(aggregate, statusFilter);
        break;
      case 7:
        this.callPickupStatusGroup(aggregate);
        break;
      default:
        throw new Error("Invalid analytics type");
    }

    const result = await Call.aggregate(aggregate);
    console.log('Analytics Result:', JSON.stringify(result, null, 2));
    return this.processResult(result[0], type, fieldKey, statusFilter);
  }

  // Total Calls
  private static totalCallsGroup(aggregate: any[]) {
    const group = { $count: "totalCalls" };
    aggregate[1].$facet.current.push(group);
    aggregate[1].$facet.previous.push(group);
  }

  // Avg Duration
  private static durationGroup(aggregate: any[]) {
    const group = {
      $group: {
        _id: null,
        avgDuration: { $sum: { $ifNull: ["$duration", 0] } }
      }
    };
    aggregate[1].$facet.current.push(group);
    aggregate[1].$facet.previous.push(group);
  }

  // Avg Cost
  private static costGroup(aggregate: any[]) {
    const lookupStage = {
      $lookup: {
        from: 'CallLogs',
        let: { callId: '$callId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$callId', '$raw_data.call.call_id'] },
                  { $eq: ['$raw_data.event', 'call_analyzed'] }
                ]
              }
            }
          },
          {
            $project: {
              combined_cost: '$raw_data.call.call_cost.combined_cost'
            }
          }
        ],
        as: 'logData'
      }
    };

    const unwindStage = {
      $unwind: {
        path: '$logData',
        preserveNullAndEmptyArrays: true
      }
    };

    const addFieldsStage = {
      $addFields: {
        combinedCost: {
          $ifNull: ['$logData.combined_cost', 0]
        }
      }
    };

    const groupStage = {
      $group: {
        _id: null,
        avgCost: { $sum: '$combinedCost' }
      }
    };

    aggregate[1].$facet.current.push(lookupStage, unwindStage, addFieldsStage, groupStage);
    aggregate[1].$facet.previous.push(lookupStage, unwindStage, addFieldsStage, groupStage);
  }

  private static statusStatsGroup(aggregate: any[], statusCodes: number[]) {
    const group = {
      $group: {
        _id: null,
        total: { $sum: 1 },
        matched: {
          $sum: {
            $cond: [{ $in: ["$status", statusCodes] }, 1, 0]
          }
        }
      }
    };

    const projection = {
      $addFields: {
        count: "$matched"
      }
    };

    aggregate[1].$facet.current.push(group, projection);
    aggregate[1].$facet.previous.push(group, projection);
  }

  private static leadStatusGroup(aggregate: any[], statusFilter?: string) {
    // Normalize status filter for case-insensitive, hyphen-agnostic matching
    const normalizeStatus = (status: string) =>
      status.toLowerCase().replace(/[-\s]/g, '');

    const matchStage = statusFilter
      ? {
        $match: {
          $expr: {
            $eq: [
              {
                $replaceAll: {
                  input: {
                    $replaceAll: {
                      input: { $toLower: "$leadStatus" },
                      find: "-",
                      replacement: ""
                    }
                  },
                  find: " ",
                  replacement: ""
                }
              },
              normalizeStatus(statusFilter)
            ]
          }
        }
      }
      : null;

    const groupStage = {
      $group: {
        _id: "$leadStatus",
        count: { $sum: 1 }
      }
    };

    const projectStage = {
      $project: {
        _id: 0,
        name: "$_id",
        count: 1
      }
    };

    const stages = matchStage
      ? [matchStage, groupStage, projectStage]
      : [groupStage, projectStage];

    aggregate[1].$facet.current.push(...stages);
    aggregate[1].$facet.previous.push(...stages);
  }


  private static callPickupStatusGroup(aggregate: any[]) {

    const SUCCESS = [
      'agent_hangup',
      'silence_timeout',
      'user_hangup',
      'max_duration_reached',
      'user_ended_call',
      'max_duration_exceeded',
      'agent_ended_call'
    ];

    const UN_SUCCESS = [
      'dial_busy',
      'dial_failed',
      'dial_no_answer',
      'error_no_audio_received',
      'inactivity',
      'invalid_destination',
      'telephony_provider_permission_denied',
      'telephony_provider_unavailable',
      'voicemail_reached',
      'voicemail_detected',
      'customer-did-not-answer',
      'twilio_error',
      'vonage_error',
      'connection_error',
      'not_connected',
      'call.in-progress.error-vapifault-worker-died',
      'twilio-reported-customer-misdialed',
      'error_asr'
    ];

    const stages = [
      {
        $addFields: {
          pickupGroup: {
            $switch: {
              branches: [
                { case: { $in: ["$disconnectionReason", SUCCESS] }, then: "pickupCalls" },
                { case: { $in: ["$disconnectionReason", UN_SUCCESS] }, then: "notPickupCalls" }
              ],
              default: "failedCalls"
            }
          }
        }
      },
      {
        $group: {
          _id: "$pickupGroup",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          count: 1
        }
      }
    ];

    aggregate[1].$facet.current.push(...stages);
    aggregate[1].$facet.previous.push(...stages);
  }



  private static processResult(data: any, type: number, fieldKey?: string, statusFilter?: string) {
    const current = data?.current || [];
    const previous = data?.previous || [];

    if (type === 1) {
      const currentData = current[0] || {};
      const previousData = previous[0] || {};
      return {
        data: {
          value: currentData.totalCalls || 0,
          change: this.calculateChange(currentData.totalCalls || 0, previousData.totalCalls || 0)
        }
      };
    }

    if (type === 2) {
      const currentData = current[0] || {};
      const previousData = previous[0] || {};
      return {
        data: {
          value: Math.round(currentData.avgDuration || 0),
          change: Number(this.calculateChange(currentData.avgDuration || 0, previousData.avgDuration || 0).toFixed(2))
        }
      };
    }

    if (type === 3) {
      const currentData = current[0] || {};
      const previousData = previous[0] || {};
      return {
        data: {
          value: parseFloat((currentData.avgCost || 0).toFixed(4)),
          change: this.calculateChange(currentData.avgCost || 0, previousData.avgCost || 0)
        }
      };
    }

    if ((type === 4 || type === 5) && fieldKey) {
      const currentData = current[0] || {};
      const previousData = previous[0] || {};
      return {
        data: {
          value: currentData.count || 0,
          change: this.calculateChange(currentData.count || 0, previousData.count || 0)
        }
      };
    }

    if (type === 6) {
      const currentMap = new Map<string, number>(
        current.map((item: any) => [
          item.name?.toLowerCase().replace(/[-\s]/g, '') || '',
          Number(item.count) || 0
        ])
      );

      const previousMap = new Map<string, number>(
        previous.map((item: any) => [
          item.name?.toLowerCase().replace(/[-\s]/g, '') || '',
          Number(item.count) || 0
        ])
      );

      // Return all statuses with counts (filtered or all)
      const result = LEAD_STATUS.map(status => {
        const normalized = status.toLowerCase().replace(/[-\s]/g, '');

        // If statusFilter is provided, only show count for matching status, others get 0
        let currentCount = 0;
        let previousCount = 0;

        if (statusFilter) {
          const normalizedFilter = statusFilter.toLowerCase().replace(/[-\s]/g, '');
          if (normalized === normalizedFilter) {
            currentCount = currentMap.get(normalized) ?? 0;
            previousCount = previousMap.get(normalized) ?? 0;
          }
        } else {
          // No filter, show actual counts for all statuses
          currentCount = currentMap.get(normalized) ?? 0;
          previousCount = previousMap.get(normalized) ?? 0;
        }

        return {
          name: status,
          count: currentCount,
          change: this.calculateChange(currentCount, previousCount)
        };
      });

      return { data: result };
    }
    if (type === 7) {

      // Convert current and previous to maps for easy lookup
      const currentMap = new Map<string, number>(
        current.map((item: any) => [
          item.name || '',
          Number(item.count) || 0
        ])
      );

      const previousMap = new Map<string, number>(
        previous.map((item: any) => [
          item.name || '',
          Number(item.count) || 0
        ])
      );

      // Expected 3 groups in output
      const GROUPS = ["pickupCalls", "notPickupCalls", "failedCalls"];

      const result = GROUPS.map(group => {
        const currentCount = currentMap.get(group) ?? 0;
        const previousCount = previousMap.get(group) ?? 0;

        return {
          name: group,
          count: currentCount,
          change: this.calculateChange(currentCount, previousCount)
        };
      });

      return { data: result };
    }
  }

  private static calculateChange(current: number, previous: number): number {
    if (previous === 0) return current === 0 ? 0 : 100;
    if (current === 0) return -100;
    return Number((((current - previous) / previous) * 100).toFixed(2));
  }

  public static async getTotalCallsStats(startDate: string, endDate: string, selectedUserId: string) {
    return this.getAnalytics(startDate, endDate, DASHBOARD_ANALYTICS_TYPE.TOTAL_CALL, [], '', selectedUserId);
  }

  public static async getDurationStats(startDate: string, endDate: string, selectedUserId: string) {
    return this.getAnalytics(startDate, endDate, DASHBOARD_ANALYTICS_TYPE.TOTAL_DURATION, [], '', selectedUserId);
  }

  public static async getCostStats(startDate: string, endDate: string, selectedUserId: string) {
    return this.getAnalytics(startDate, endDate, DASHBOARD_ANALYTICS_TYPE.TOTAL_COST, [], '', selectedUserId);
  }

  public static async getStatusStats(
    startDate: string,
    endDate: string,
    statusCodes: number[],
    fieldKey: string,
    selectedUserId: string
  ) {
    const analyticsType = statusCodes.includes(CALL_STATUS.FAILED) || statusCodes.includes(CALL_STATUS.ERROR)
      ? DASHBOARD_ANALYTICS_TYPE.FAILED_CALLS
      : DASHBOARD_ANALYTICS_TYPE.ENDED_CALLS;

    return this.getAnalytics(startDate, endDate, analyticsType, statusCodes, fieldKey, selectedUserId);
  }

  public static async getLeadStatusStats(
    startDate: string,
    endDate: string,
    selectedUserId: string,
    statusFilter?: string
  ) {
    return this.getAnalytics(
      startDate,
      endDate,
      DASHBOARD_ANALYTICS_TYPE.LEAD_STATUS,
      [],
      '',
      selectedUserId,
      statusFilter
    );
  }

  public static async getCallPickupStatusStats(
    startDate: string,
    endDate: string,
    selectedUserId: string,
  ) {
    return this.getAnalytics(
      startDate,
      endDate,
      DASHBOARD_ANALYTICS_TYPE.CALL_PICKUP_STATUS,
      [],
      '',
      selectedUserId
    );
  }
}