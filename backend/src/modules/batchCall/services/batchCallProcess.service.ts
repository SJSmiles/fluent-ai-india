import { Recipient } from "../models/recipient.model";
import { BatchCall } from "../models/batchCall.model";
import { BATCH_CALL_PROCESS_STATUS, BATCH_CALL_STATUS } from "../../../config/server-config";
import axios, { AxiosError } from 'axios';
import { BatchCallFollowUps } from "../models/batchCallFollowUps.model";
import { User } from "../../users/models/user.model";
import { Company } from "../../company/models/company.model";
import { Call } from "../../webhook/models/call.model";
import { GoogleSheetDataProcess } from "../../google-sheet/models/google-sheet.model";

// ============================================================
// LOGGING SYSTEM
// ============================================================

enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}

interface LogContext {
  batchId?: string;
  recipientId?: string;
  callId?: string;
  companyId?: string;
  status?: string | number;
  count?: number;
  duration?: number;
  [key: string]: any;
}

class Logger {
  private static formatTimestamp(): string {
    return new Date().toISOString();
  }

  private static formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = this.formatTimestamp();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    const emoji = this.getEmoji(level);
    return `[${timestamp}] ${emoji} ${level}: ${message}${contextStr}`;
  }

  private static getEmoji(level: LogLevel): string {
    const emojiMap = {
      [LogLevel.DEBUG]: '🔍',
      [LogLevel.INFO]: 'ℹ️',
      [LogLevel.WARN]: '⚠️',
      [LogLevel.ERROR]: '❌',
      [LogLevel.SUCCESS]: '✅'
    };
    return emojiMap[level] || '📝';
  }

  static debug(message: string, context?: LogContext): void {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      console.log(this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  static info(message: string, context?: LogContext): void {
    console.log(this.formatMessage(LogLevel.INFO, message, context));
  }

  static warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, context));
  }

  static error(message: string, error?: any, context?: LogContext): void {
    const errorDetails = error ? {
      message: error.message,
      stack: error.stack,
      code: error.code,
      response: error.response?.data,
      ...context
    } : context;
    console.error(this.formatMessage(LogLevel.ERROR, message, errorDetails));
  }

  static success(message: string, context?: LogContext): void {
    console.log(this.formatMessage(LogLevel.SUCCESS, message, context));
  }

  static startTimer(): () => number {
    const start = Date.now();
    return () => Date.now() - start;
  }
}

// ============================================================
// PERFORMANCE METRICS
// ============================================================

class PerformanceMetrics {
  private metrics: Map<string, { count: number; totalDuration: number; errors: number }> = new Map();

  track(operation: string, duration: number, isError: boolean = false): void {
    const existing = this.metrics.get(operation) || { count: 0, totalDuration: 0, errors: 0 };
    this.metrics.set(operation, {
      count: existing.count + 1,
      totalDuration: existing.totalDuration + duration,
      errors: existing.errors + (isError ? 1 : 0)
    });
  }

  getReport(): string {
    const report: string[] = ['\n📊 Performance Metrics Report:'];
    this.metrics.forEach((value, key) => {
      const avgDuration = (value.totalDuration / value.count).toFixed(2);
      const errorRate = ((value.errors / value.count) * 100).toFixed(2);
      report.push(
        `  ${key}: ${value.count} calls, avg ${avgDuration}ms, ${errorRate}% errors`
      );
    });
    return report.join('\n');
  }

  reset(): void {
    this.metrics.clear();
  }
}

const performanceMetrics = new PerformanceMetrics();

// ============================================================
// CONFIGURATION & CONSTANTS
// ============================================================

const CONFIG = {
  HARD_TIMEOUT_MS: 30 * 60 * 1000,  // 30 minutes
  SOFT_TIMEOUT_MS: 5 * 60 * 1000,  // 10 minutes
  VAPI_API_BASE: 'https://api.vapi.ai/v2',
  BULK_WRITE_CHUNK_SIZE: 500,
  MAX_VAPI_BATCH_SIZE: 100
} as const;

// ============================================================
// STUCK RECIPIENT CLEANER
// ============================================================

class StuckRecipientCleaner {
  async cleanHardStuckRecipients(): Promise<number> {
    const timer = Logger.startTimer();
    const hardCutoff = new Date(Date.now() - CONFIG.HARD_TIMEOUT_MS);
    const softCutoff = new Date(Date.now() - CONFIG.SOFT_TIMEOUT_MS);

    /* -------------------- Find stuck GoogleSheet calls -------------------- */
    const stuckCalls = await GoogleSheetDataProcess.find({
      callStatus: { $in: [1, 2] }, // IN_PROCESS
      updatedAt: { $lt: softCutoff },
      callId: { $ne: null },
      companyId: { $ne: null }
    });

    if (!stuckCalls.length) {
      Logger.debug('No stuck GoogleSheet calls found');
    }

    if (stuckCalls.length > 0) {
      Logger.debug('Found stuck GoogleSheet calls', { count: stuckCalls.length });
      /* -------------------- Group calls by companyId -------------------- */
      const callsByCompany = new Map<string, any[]>();

      for (const call of stuckCalls) {
        const companyId = call.companyId.toString();
        if (!callsByCompany.has(companyId)) {
          callsByCompany.set(companyId, []);
        }
        callsByCompany.get(companyId)!.push(call);
      }

      Logger.debug('Grouped stuck calls by company', { companyCount: callsByCompany.size });

      /* -------------------- Process per company -------------------- */
      for (const [companyId, companyCalls] of callsByCompany.entries()) {
        const company: any = await Company.findById(companyId);

        if (!company) {
          Logger.warn('Company not found, skipping calls', { companyId });
          continue;
        }

        const vapiProvider = company.voiceProviders?.find(
          (v: any) => v.name === 'vapi'
        );

        if (!vapiProvider?.api_key_id) {
          Logger.error('VAPI provider not configured', null, { companyId });
          continue;
        }

        const vapiClient = new VapiClient(vapiProvider.api_key_id);

        /* -------------------- Collect callIds -------------------- */
        const callIds = companyCalls
          .map(c => c.callId?.toString())
          .filter(Boolean);

        if (!callIds.length) continue;

        /* -------------------- Fetch from VAPI (BATCH) -------------------- */
        let vapiCalls: any[] = [];
        try {
          vapiCalls = await vapiClient.fetchCallsByIds(callIds);
        } catch (err) {
          Logger.error('VAPI batch fetch failed', err, { companyId });
          continue;
        }

        const vapiMap = new Map(vapiCalls.map(c => [c.id, c]));
        const bulkOps: any[] = [];

        /* -------------------- Process GoogleSheet records -------------------- */
        for (const sheetRecord of companyCalls) {
          const callId = sheetRecord.callId?.toString();
          if (!callId) continue;

          const vapiCall = vapiMap.get(callId);

          if (!vapiCall) {
            Logger.debug('Call not found in VAPI', {
              callId,
              sheetRecordId: sheetRecord._id.toString()
            });
            continue;
          }

          /* -------------------- FAILED from VAPI -------------------- */
          if (vapiCall.ended_message) {
            bulkOps.push({
              updateOne: {
                filter: { _id: sheetRecord._id },
                update: {
                  $set: {
                    callStatus: 4,
                    endedReason: vapiCall.endedReason,
                    errorMessage: vapiCall.ended_message,
                    updatedAt: new Date()
                  }
                }
              }
            });

            Logger.debug('GoogleSheet record marked FAILED from VAPI', {
              sheetRecordId: sheetRecord._id.toString(),
              callId,
              endedReason: vapiCall.endedReason,
              errorMessage: vapiCall.ended_message
            });
          }
        }

        Logger.debug('Prepared bulk operations for GoogleSheet records', {
          companyId,
          operations: bulkOps.length
        });

        /* -------------------- Execute bulk updates -------------------- */
        if (bulkOps.length > 0) {
          await GoogleSheetDataProcess.bulkWrite(bulkOps);
          Logger.info('Bulk update executed for GoogleSheet records', {
            companyId,
            updated: bulkOps.length
          });
        }
      }
    }

    await GoogleSheetDataProcess.updateMany({
      callStatus: { $in: [1, 2] },
      updatedAt: { $lt: hardCutoff }
    }, {
      $set: {
        callStatus: 4,
        errorMessage: `Hard stuck in process for more than ${CONFIG.HARD_TIMEOUT_MS / 60000} minutes`,
        updatedAt: new Date()
      }
    });
    try {
      Logger.info('🧹 Cleaning hard-stuck recipients', {
        cutoffTime: hardCutoff.toISOString(),
        timeoutMinutes: CONFIG.HARD_TIMEOUT_MS / 60000
      });

      const result = await Recipient.updateMany(
        {
          status: BATCH_CALL_PROCESS_STATUS.IN_PROCESS,
          updatedAt: { $lt: hardCutoff }
        },
        {
          $set: {
            status: BATCH_CALL_PROCESS_STATUS.FAILED,
            errorMessage: `Recipient stuck in process for more than ${CONFIG.HARD_TIMEOUT_MS / 60000} minutes`,
            updatedAt: new Date()
          },
          $inc: { maxAttempts: -1 }
        }
      );

      performanceMetrics.track('cleanHardStuckRecipients', timer());

      if (result.modifiedCount > 0) {
        Logger.success('Hard-stuck recipients cleaned', {
          count: result.modifiedCount,
          duration: timer()
        });
      } else {
        Logger.info('No hard-stuck recipients found', {
          duration: timer()
        });
      }

      return result.modifiedCount;
    } catch (error) {
      performanceMetrics.track('cleanHardStuckRecipients', timer(), true);
      Logger.error('Error cleaning hard-stuck recipients', error);
      throw error;
    }
  }
}

// ============================================================
// COMPANY RESOLVER
// ============================================================

class CompanyResolver {
  async resolve(batchCall: any): Promise<any> {
    const timer = Logger.startTimer();

    try {
      Logger.debug('Resolving company for batch', {
        batchId: batchCall._id.toString(),
        hasCompanyId: !!batchCall.companyId
      });

      let companyId = batchCall.companyId;

      // Resolve from user if not present
      if (!companyId && batchCall.createdBy) {
        const user: any = await User.findById(batchCall.createdBy).select("companyId");
        companyId = user?.companyId;

        Logger.debug('Resolved companyId from user', {
          userId: batchCall.createdBy.toString(),
          companyId: companyId?.toString()
        });
      }

      if (!companyId) {
        Logger.warn('No companyId found for batch', {
          batchId: batchCall._id.toString()
        });
        return null;
      }

      const company = await Company.findById(companyId);

      if (!company) {
        Logger.warn('Company not found', {
          companyId: companyId.toString()
        });
        return null;
      }

      performanceMetrics.track('resolveCompany', timer());
      Logger.debug('Company resolved', {
        companyId: companyId.toString(),
        duration: timer()
      });

      return company;
    } catch (error) {
      performanceMetrics.track('resolveCompany', timer(), true);
      Logger.error('Error resolving company', error, {
        batchId: batchCall._id.toString()
      });
      throw error;
    }
  }
}

// ============================================================
// VAPI CLIENT
// ============================================================

class VapiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = CONFIG.VAPI_API_BASE;
  }

  async fetchCallsByIds(callIds: string[]): Promise<any[]> {
    const timer = Logger.startTimer();

    try {
      Logger.info('📞 Fetching calls from VAPI', {
        count: callIds.length
      });

      const params = new URLSearchParams();
      callIds.forEach(id => params.append("idAny[]", id));

      const response = await axios.get(
        `${this.baseUrl}/call?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      const calls = response.data?.results || [];

      performanceMetrics.track('fetchVapiCalls', timer());
      Logger.success('VAPI calls fetched', {
        requested: callIds.length,
        received: calls.length,
        duration: timer()
      });

      return calls;
    } catch (error) {
      performanceMetrics.track('fetchVapiCalls', timer(), true);

      if (axios.isAxiosError(error)) {
        Logger.error('VAPI API error', null, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          callCount: callIds.length
        });
      } else {
        Logger.error('Error fetching VAPI calls', error, {
          callCount: callIds.length
        });
      }

      throw error;
    }
  }
}

// ============================================================
// RECIPIENT STATUS RESOLVER
// ============================================================

class RecipientStatusResolver {
  // async resolveFromLocalCalls(
  //   pendingRecipients: any[],
  //   batchCall: any
  // ): Promise<{ resolved: number; unresolved: string[] }> {
  //   const timer = Logger.startTimer();

  //   try {
  //     Logger.info('🔍 Resolving recipients from local calls', {
  //       batchId: batchCall._id.toString(),
  //       recipientCount: pendingRecipients.length
  //     });

  //     // Extract call IDs
  //     const callIds = pendingRecipients
  //       .map(r => r.callResponse?.at(-1)?.id)
  //       .filter(Boolean)
  //       .map((id: string) => id.toString().trim());

  //     if (!callIds.length) {
  //       Logger.warn('No call IDs found in recipients', {
  //         batchId: batchCall._id.toString()
  //       });
  //       return { resolved: 0, unresolved: [] };
  //     }

  //     Logger.debug('Fetching local calls', {
  //       callCount: callIds.length
  //     });

  //     // Fetch local calls
  //     const calls = await Call.find({ callId: { $in: callIds } }).lean();
  //     const callMap = new Map(calls.map(c => [c.callId, c]));

  //     Logger.debug('Local calls fetched', {
  //       found: calls.length,
  //       requested: callIds.length
  //     });

  //     const unresolved: string[] = [];
  //     const bulkOps: any[] = [];

  //     // Process each recipient
  //     for (const recipient of pendingRecipients) {
  //       const callId = recipient.callResponse?.at(-1)?.id?.toString();
  //       if (!callId) continue;

  //       const call: any = callMap.get(callId);

  //       if (!call) {
  //         unresolved.push(callId);
  //         Logger.debug('Call not found locally', {
  //           callId,
  //           recipientId: recipient._id.toString()
  //         });
  //         continue;
  //       }

  //       const status = this.calculateStatus(call);

  //       bulkOps.push({
  //         updateOne: {
  //           filter: {
  //             _id: recipient._id
  //           },
  //           update: [
  //             {
  //               $set: {
  //                 status: status,
  //                 updatedAt: new Date(),

  //                 allCallData: {
  //                   $cond: [
  //                     {
  //                       $in: [
  //                         call.callId,
  //                         {
  //                           $map: {
  //                             input: "$allCallData",
  //                             as: "c",
  //                             in: "$$c.callId"
  //                           }
  //                         }
  //                       ]
  //                     },
  //                     "$allCallData",              // callId exists → do NOT push
  //                     { $concatArrays: ["$allCallData", [call]] } // callId not exists → push
  //                   ]
  //                 }
  //               }
  //             }
  //           ]
  //         }
  //       });



  //       Logger.debug('Recipient status resolved locally', {
  //         recipientId: recipient._id.toString(),
  //         callId,
  //         status,
  //         disconnectionReason: call.disconnectionReason,
  //         duration: call.duration
  //       });
  //     }

  //     // Execute bulk updates
  //     if (bulkOps.length > 0) {
  //       await this.executeBulkOps(bulkOps);
  //     }

  //     performanceMetrics.track('resolveFromLocalCalls', timer());
  //     Logger.success('Local resolution complete', {
  //       total: pendingRecipients.length,
  //       resolved: bulkOps.length,
  //       unresolved: unresolved.length,
  //       duration: timer()
  //     });

  //     return { resolved: bulkOps.length, unresolved };
  //   } catch (error) {
  //     performanceMetrics.track('resolveFromLocalCalls', timer(), true);
  //     Logger.error('Error resolving from local calls', error, {
  //       batchId: batchCall._id.toString()
  //     });
  //     throw error;
  //   }
  // }

  async resolveFromVapi(
    pendingRecipients: any[],
    unresolvedCallIds: string[],
    vapiClient: VapiClient,
    localCallMap: Map<string, any>,
    batchCall: any
  ): Promise<number> {
    const timer = Logger.startTimer();

    try {
      if (!unresolvedCallIds.length) {
        Logger.debug('No unresolved calls to fetch from VAPI');
        return 0;
      }

      Logger.info('🔍 Resolving recipients from VAPI', {
        callCount: unresolvedCallIds.length
      });

      // Fetch from VAPI
      const vapiCalls = await vapiClient.fetchCallsByIds(unresolvedCallIds);
      const vapiMap = new Map(vapiCalls.map((c: any) => [c.id, c]));

      const bulkOps: any[] = [];

      // Process recipients
      for (const recipient of pendingRecipients) {
        const callId = recipient.callResponse?.at(-1)?.id?.toString();
        if (!callId || localCallMap.has(callId)) continue;

        const vapiCall: any = vapiMap.get(callId);
        if (!vapiCall) {
          Logger.debug('Call not found in VAPI', {
            callId,
            recipientId: recipient._id.toString()
          });
          continue;
        }

        // Handle failed calls
        if (vapiCall.ended_message) {
          bulkOps.push({
            updateOne: {
              filter: { _id: recipient._id },
              update: {
                $set: {
                  status: BATCH_CALL_PROCESS_STATUS.FAILED,
                  endedReason: vapiCall.endedReason,
                  errorMessage: vapiCall.ended_message,
                  updatedAt: new Date()
                },
                $push: { errorMessages: vapiCall.ended_message },
                $inc: { maxAttempts: -1 }
              }
            }
          });

          Logger.debug('Recipient marked as failed from VAPI', {
            recipientId: recipient._id.toString(),
            callId,
            endedReason: vapiCall.endedReason,
            errorMessage: vapiCall.ended_message
          });
        }
      }

      // Execute bulk updates
      if (bulkOps.length > 0) {
        await this.executeBulkOps(bulkOps);
        if (batchCall.processedRecipient < batchCall.totalRecipient) {
          await BatchCall.updateOne({ _id: batchCall._id }, { $inc: { processedRecipient: bulkOps.length } });
        }

      }

      performanceMetrics.track('resolveFromVapi', timer());
      Logger.success('VAPI resolution complete', {
        requested: unresolvedCallIds.length,
        found: vapiCalls.length,
        resolved: bulkOps.length,
        duration: timer()
      });

      return bulkOps.length;
    } catch (error) {
      performanceMetrics.track('resolveFromVapi', timer(), true);
      Logger.error('Error resolving from VAPI', error, {
        callCount: unresolvedCallIds.length
      });
      throw error;
    }
  }

  private calculateStatus(call: any): number {
    const isSuccess =
      BATCH_CALL_PROCESS_STATUS.SUCCESS.includes(call.disconnectionReason) &&
      call.duration >= BATCH_CALL_PROCESS_STATUS.MIN_TIME_FOR_SUCCESS &&
      call.leadStatus !== "Do Not Contact";

    return isSuccess
      ? BATCH_CALL_PROCESS_STATUS.SUCCESS_VALUE
      : BATCH_CALL_PROCESS_STATUS.DEAD;
  }

  private async executeBulkOps(ops: any[]): Promise<void> {
    const chunks = this.chunkArray(ops, CONFIG.BULK_WRITE_CHUNK_SIZE);

    Logger.debug('Executing bulk operations', {
      totalOps: ops.length,
      chunks: chunks.length
    });

    for (const chunk of chunks) {
      try {
        await Recipient.bulkWrite(chunk, { ordered: false });
      } catch (err: any) {
        Logger.warn('Some bulk operations failed', {
          error: err?.message,
          chunkSize: chunk.length
        });
      }
    }
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      out.push(arr.slice(i, i + size));
    }
    return out;
  }
}

// ============================================================
// BATCH COMPLETION HANDLER
// ============================================================

class BatchCompletionHandler {
  async checkAndComplete(batchCall: any): Promise<boolean> {
    const timer = Logger.startTimer();

    try {
      Logger.info('🔍 Checking batch completion', {
        batchId: batchCall._id.toString()
      });

      // Check if any recipients still in process
      const stillProcessing = await Recipient.countDocuments({
        batchCallId: batchCall._id,
        status: BATCH_CALL_PROCESS_STATUS.IN_PROCESS
      });

      if (stillProcessing > 0) {
        Logger.info('Batch still has processing recipients', {
          batchId: batchCall._id.toString(),
          processingCount: stillProcessing
        });
        return false;
      }

      // Get completion stats
      const stats = await this.getCompletionStats(batchCall._id);

      if (!stats) {
        Logger.warn('No recipients found for batch', {
          batchId: batchCall._id.toString()
        });
        return false;
      }

      const { total, completed } = stats;

      Logger.info('Batch completion status', {
        batchId: batchCall._id.toString(),
        total,
        completed,
        percentage: ((completed / total) * 100).toFixed(2)
      });

      if (total === completed) {
        await this.markComplete(batchCall, completed);
        performanceMetrics.track('checkAndCompleteBatch', timer());
        return true;
      }

      performanceMetrics.track('checkAndCompleteBatch', timer());
      return false;
    } catch (error) {
      performanceMetrics.track('checkAndCompleteBatch', timer(), true);
      Logger.error('Error checking batch completion', error, {
        batchId: batchCall._id.toString()
      });
      throw error;
    }
  }

  private async getCompletionStats(batchId: any): Promise<{ total: number; completed: number } | null> {
    const stats = await Recipient.aggregate([
      { $match: { batchCallId: batchId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [
                {
                  $in: ["$status", [
                    BATCH_CALL_PROCESS_STATUS.SUCCESS_VALUE,
                    BATCH_CALL_PROCESS_STATUS.DEAD,
                    BATCH_CALL_PROCESS_STATUS.SKIP,
                    BATCH_CALL_PROCESS_STATUS.FAILED
                  ]]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    return stats.length > 0 ? stats[0] : null;
  }

  private async markComplete(batchCall: any, completedCount: number): Promise<void> {
    const timer = Logger.startTimer();

    try {
      const result = await BatchCall.updateOne(
        {
          _id: batchCall._id,
          status: { $ne: BATCH_CALL_STATUS.COMPLETED }
        },
        {
          $set: {
            status: BATCH_CALL_STATUS.COMPLETED,
            processedRecipient: completedCount,
            updatedAt: new Date()
          }
        }
      );

      if (result.modifiedCount > 0) {

        await BatchCallFollowUps.updateMany(
          {
            batchCallId: batchCall._id,
            status: { $ne: BATCH_CALL_STATUS.COMPLETED }
          },
          [
            {
              $set: {
                status: BATCH_CALL_STATUS.COMPLETED,
                processedRecipient: '$totalRecipient',
                updatedAt: new Date()
              }
            }
          ]
        );


        Logger.success('Batch marked as completed', {
          batchId: batchCall._id.toString(),
          processedRecipients: completedCount
        });
      } else {
        Logger.debug('Batch already marked as completed by another process', {
          batchId: batchCall._id.toString()
        });
      }

      performanceMetrics.track('markBatchComplete', timer());
    } catch (error) {
      performanceMetrics.track('markBatchComplete', timer(), true);
      Logger.error('Error marking batch complete', error, {
        batchId: batchCall._id.toString()
      });
      throw error;
    }
  }
}

// ============================================================
// VAPI BATCH PROCESSOR
// ============================================================

class VapiBatchProcessor {
  private companyResolver: CompanyResolver;
  private statusResolver: RecipientStatusResolver;
  private completionHandler: BatchCompletionHandler;

  constructor() {
    this.companyResolver = new CompanyResolver();
    this.statusResolver = new RecipientStatusResolver();
    this.completionHandler = new BatchCompletionHandler();
  }

  async process(batchCall: any): Promise<void> {
    const timer = Logger.startTimer();

    try {
      Logger.info('🚀 Processing batch with VAPI resolution', {
        batchId: batchCall._id.toString(),
        batchName: batchCall.name
      });

      // Resolve company
      const company = await this.companyResolver.resolve(batchCall);
      if (!company) {
        Logger.warn('Skipping batch - company not found', {
          batchId: batchCall._id.toString()
        });
        return;
      }

      // Get VAPI provider
      const vapiProvider = company.voiceProviders?.find((v: any) => v.name === "vapi");
      if (!vapiProvider?.api_key_id) {
        Logger.error('VAPI provider not configured', null, {
          batchId: batchCall._id.toString(),
          companyId: company._id.toString()
        });
        throw new Error("VAPI provider not configured");
      }

      // Find soft-stuck recipients
      const softCutoff = new Date(Date.now() - CONFIG.SOFT_TIMEOUT_MS);
      const pendingRecipients = await Recipient.find({
        batchCallId: batchCall._id,
        status: BATCH_CALL_PROCESS_STATUS.IN_PROCESS,
        updatedAt: { $lt: softCutoff }
      });

      Logger.info('Found soft-stuck recipients', {
        batchId: batchCall._id.toString(),
        count: pendingRecipients.length,
        cutoffTime: softCutoff.toISOString()
      });

      if (!pendingRecipients.length) {
        await this.completionHandler.checkAndComplete(batchCall);
        performanceMetrics.track('processVapiBatch', timer());
        return;
      }

      // Resolve from local calls
      // const { resolved: localResolved, unresolved } = await this.statusResolver.resolveFromLocalCalls(pendingRecipients, batchCall);

      const unresolved: string[] = [];
      for (const recipient of pendingRecipients) {

        const responses = recipient.callResponse;

        if (!Array.isArray(responses) || responses.length === 0) {
          continue;
        }

        const lastResponse = responses[responses.length - 1];
        const callId = lastResponse?.id?.toString();

        if (!callId) {
          continue;
        }

        unresolved.push(callId);
      }

      // Resolve from VAPI if needed
      let vapiResolved = 0;

      if (unresolved.length > 0) {
        const vapiClient = new VapiClient(vapiProvider.api_key_id);
        const localCallMap = new Map<string, boolean>();

        vapiResolved = await this.statusResolver.resolveFromVapi(
          pendingRecipients,
          unresolved,
          vapiClient,
          localCallMap,
          batchCall
        );
      }

      Logger.success('Batch processing complete', {
        batchId: batchCall._id.toString(),
        totalStuck: pendingRecipients.length,
        vapiResolved,
        duration: timer()
      });


      // Final completion check
      await this.completionHandler.checkAndComplete(batchCall);

      performanceMetrics.track('processVapiBatch', timer());
    } catch (error) {
      performanceMetrics.track('processVapiBatch', timer(), true);
      Logger.error('Error processing VAPI batch', error, {
        batchId: batchCall._id.toString()
      });
      throw error;
    }
  }
}




// ============================================================
// MAIN SERVICE CLASS
// ============================================================

class BatchCallProcessService {
  private stuckCleaner: StuckRecipientCleaner;
  private vapiBatchProcessor: VapiBatchProcessor;

  constructor() {
    this.stuckCleaner = new StuckRecipientCleaner();
    this.vapiBatchProcessor = new VapiBatchProcessor();
  }

  public async processInProcessRecipients(): Promise<void> {
    const overallTimer = Logger.startTimer();

    try {
      Logger.info('='.repeat(60));
      Logger.info('🚀 Starting In-Process Recipients Cleanup');
      Logger.info('='.repeat(60));

      // 1️⃣ Clean hard-stuck recipients
      const hardStuckCount = await this.stuckCleaner.cleanHardStuckRecipients();

      // 2️⃣ Fetch active batches
      const batches = await this.fetchActiveBatches();


      if (!batches.length) {
        Logger.info('No active batches found');
        Logger.info('='.repeat(60));
        return;
      }
      Logger.info('Active batches found', {
        count: batches.length
      });

      // 3️⃣ Process each batch
      let successCount = 0;
      let errorCount = 0;

      for (const batch of batches) {
        try {
          const batchCall = await BatchCall.findById(batch._id);
          if (!batchCall) {
            Logger.warn('Batch not found', { batchId: batch._id.toString() });
            continue;
          }

          await this.vapiBatchProcessor.process(batchCall);
          successCount++;
        } catch (err: any) {
          errorCount++;
          Logger.error('Error processing batch', err, {
            batchId: batch._id.toString()
          });
          // Continue with next batch
        }
      }

      performanceMetrics.track('processInProcessRecipients', overallTimer());

      Logger.success('Cleanup process complete', {
        totalBatches: batches.length,
        successful: successCount,
        failed: errorCount,
        hardStuckCleaned: hardStuckCount,
        totalDuration: overallTimer()
      });

      //Logger.info(performanceMetrics.getReport());
      Logger.info('='.repeat(60));

    } catch (error) {
      performanceMetrics.track('processInProcessRecipients', overallTimer(), true);
      Logger.error('Fatal error in processInProcessRecipients', error, {
        duration: overallTimer()
      });
      Logger.info('='.repeat(60));
      throw error;
    }
  }

  private async fetchActiveBatches(): Promise<any[]> {
    const timer = Logger.startTimer();

    try {
      Logger.debug('Fetching active batches...');

      const batches = await BatchCall.find({
        isArchived: false,
        status: BATCH_CALL_STATUS.IN_PROCESS
      }).lean();

      performanceMetrics.track('fetchActiveBatches', timer());

      Logger.debug('Active batches fetched', {
        count: batches.length,
        duration: timer()
      });

      return batches;
    } catch (error) {
      performanceMetrics.track('fetchActiveBatches', timer(), true);
      Logger.error('Error fetching active batches', error);
      throw error;
    }
  }
}

// ============================================================
// EXPORT
// ============================================================

const batchCallProcessService = new BatchCallProcessService();
export { batchCallProcessService, BatchCallProcessService };