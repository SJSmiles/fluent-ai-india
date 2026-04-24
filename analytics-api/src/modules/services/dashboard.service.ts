
import { getComparisonRanges } from "@helper/dateHelper";
import {
  ANSWER_CALLS,
  ANSWERED_LEAD_STATUSES,
  CALL_STATUS,
  DASHBOARD_ANALYTICS_TYPE,
  LEAD_STATUS,
  LEAD_STATUSES_COMMONS,
  NO_ANSWER_CALLS,
  SUCCESS_STATUSES,

} from "../../config/server-config";
import { Types } from "mongoose";
import { Calls } from "modules/models/calls.model";
import { User } from "modules/models/user.model";

export class AnalyticsService {
  public static async getAnalytics(
    startDate: string,
    endDate: string,
    type: number,
    statusCodes?: number[],
    fieldKey?: string,
    selectedUserId?: string,
    statusFilter?: string,
    agentId?: string,
    userDetails?: any
  ) {
    // Use your helper to get the current range (we ignore previousRange entirely)
    const { currentRange } = getComparisonRanges(startDate, endDate);

    // Base match stage: date range + optional createdBy
    const baseMatch: any = {
      createdAt: {
        $gte: currentRange.start,
        $lte: currentRange.end,
      },
    };

    if (selectedUserId) {
      baseMatch.createdBy = new Types.ObjectId(selectedUserId);
    }

    if (agentId) {
      baseMatch.agentId = agentId;
    }

    // Build a single pipeline per request (no $facet)
    let pipeline: any[] = [{ $match: baseMatch }];

    switch (type) {
      // Type 1: Total Calls -> count
      case DASHBOARD_ANALYTICS_TYPE.TOTAL_CALL:
      case 1: {
        // === CURRENT PERIOD - Unique calls across entire date range ===
        const currentPipeline = [
          { $match: baseMatch },
          {
            $group: {
              _id: "$toNumber", // Only group by toNumber, not by date
            },
          },
          {
            $count: "totalCalls",
          },
        ];

        const currentRes = await Calls.aggregate(currentPipeline);
        const currentValue = currentRes[0]?.totalCalls ?? 0;

        console.log(
          "📊 TOTAL CALLS ANALYTICS - Unique Calls Across Date Range"
        );
        console.log("================================================");
        console.log("📅 Date Ranges:");
        console.log("  Current Period:", {
          start: currentRange.start,
          end: currentRange.end,
        });

        // === PREVIOUS PERIOD - Unique calls across entire date range ===
        const { previousRange } = getComparisonRanges(startDate, endDate);
        console.log("  Previous Period:", {
          start: previousRange.start,
          end: previousRange.end,
        });

        const previousMatch: any = {
          createdAt: {
            $gte: previousRange.start,
            $lte: previousRange.end,
          },
        };

        if (selectedUserId) {
          previousMatch.createdBy = new Types.ObjectId(selectedUserId);
        }

        if (agentId) {
          previousMatch.agentId = agentId;
        }

        const previousPipeline = [
          { $match: previousMatch },
          {
            $group: {
              _id: "$toNumber",
            },
          },
          {
            $count: "totalCalls",
          },
        ];

        const previousRes = await Calls.aggregate(previousPipeline);
        const previousValue = previousRes[0]?.totalCalls ?? 0;

        console.log("\n📈 Call Counts (Unique Across Range):");
        console.log("  Current Value:", currentValue);
        console.log("  Previous Value:", previousValue);

        // Calculate percentage with cap at ±100%
        let comparedValue = "+0%";

        if (previousValue === 0 && currentValue > 0) {
          // Previous was 0, now we have calls → +100%
          console.log("\n🔢 Percentage Calculation:");
          console.log("  Formula: Previous was 0, current > 0");
          console.log("  Result: +100% (capped)");
          comparedValue = "+100%";
        } else if (previousValue === 0 && currentValue === 0) {
          // Both are 0
          console.log("\n🔢 Percentage Calculation:");
          console.log("  Formula: Both values are 0");
          console.log("  Result: +0%");
          comparedValue = "+0%";
        } else if (previousValue > 0 && currentValue === 0) {
          // Had calls before, now 0 → -100%
          console.log("\n🔢 Percentage Calculation:");
          console.log("  Formula: Previous > 0, current = 0");
          console.log("  Result: -100% (complete drop)");
          comparedValue = "-100%";
        } else if (previousValue > 0) {
          // Normal calculation with cap
          const difference = currentValue - previousValue;
          let percentage = (difference / previousValue) * 100;

          console.log("\n🔢 Percentage Calculation:");
          console.log("  Formula: ((Current - Previous) / Previous) × 100");
          console.log(
            `  Calculation: ((${currentValue} - ${previousValue}) / ${previousValue}) × 100`
          );
          console.log(
            `  Step 1: ${currentValue} - ${previousValue} = ${difference}`
          );
          console.log(
            `  Step 2: ${difference} / ${previousValue} = ${(difference / previousValue).toFixed(4)}`
          );
          console.log(
            `  Step 3: ${(difference / previousValue).toFixed(4)} × 100 = ${percentage.toFixed(2)}`
          );

          const rawPercentage = percentage;

          // Cap at ±100%
          if (percentage > 100) {
            console.log(
              `  Step 4: Capping ${rawPercentage.toFixed(2)}% to +100%`
            );
            percentage = 100;
          } else if (percentage < -100) {
            console.log(
              `  Step 4: Capping ${rawPercentage.toFixed(2)}% to -100%`
            );
            percentage = -100;
          }

          const sign = percentage >= 0 ? "+" : "";

          // Format: if it's exactly ±100, show without decimals
          if (percentage === 100 || percentage === -100) {
            comparedValue = `${sign}${Math.abs(percentage)}%`;
          } else {
            comparedValue = `${sign}${percentage.toFixed(2)}%`;
          }

          console.log(`  Final Result: ${comparedValue}`);
        }

        console.log("\n✅ Final Response:", {
          value: currentValue,
          comparedValue,
        });
        console.log("================================================\n");

        return {
          data: {
            value: currentValue,
            comparedValue: comparedValue,
          },
        };
      }

      // Type 2: Total Duration -> sum of duration
      case DASHBOARD_ANALYTICS_TYPE.TOTAL_DURATION:
      case 2: {
        // Group by toNumber (across entire range), sum duration for each unique number
        pipeline.push(
          {
            $group: {
              _id: "$toNumber", // Only group by toNumber
              totalDurationMs: { $sum: { $ifNull: ["$duration", 0] } },
            },
          },
          {
            $group: {
              _id: null,
              totalDurationMs: { $sum: "$totalDurationMs" },
            },
          },
          {
            $project: {
              totalDurationSeconds: {
                $round: [{ $divide: ["$totalDurationMs", 1000] }, 0],
              },
            },
          }
        );

        const res = await Calls.aggregate(pipeline);
        const value = res[0]?.totalDurationSeconds ?? 0;

        console.log("⏱️ TOTAL DURATION ANALYTICS (Unique Calls Across Range)");
        console.log("================================================");
        console.log("📊 Stats:");
        console.log("  Total Duration (seconds):", value);
        console.log("================================================\n");

        return { data: { value } };
      }

      // Type 3: Total Cost -> lookup CallLogs then sum combined_cost
      case DASHBOARD_ANALYTICS_TYPE.TOTAL_COST:
      case 3: {
        // lookup call logs to find combined_cost (same logic as original)
        pipeline.push(
          {
            $lookup: {
              from: "CallLogs",
              let: { callId: "$callId" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$callId", "$raw_data.call.call_id"] },
                        { $eq: ["$raw_data.event", "call_analyzed"] },
                      ],
                    },
                  },
                },
                {
                  $project: {
                    combined_cost: "$raw_data.call.call_cost.combined_cost",
                  },
                },
              ],
              as: "logData",
            },
          },
          {
            $unwind: { path: "$logData", preserveNullAndEmptyArrays: true },
          },
          {
            $addFields: {
              combinedCost: { $ifNull: ["$logData.combined_cost", 0] },
            },
          },
          {
            $group: {
              _id: null,
              totalCost: { $sum: "$combinedCost" },
            },
          }
        );

        const res = await Calls.aggregate(pipeline);
        const value = parseFloat((res[0]?.totalCost ?? 0).toFixed(4));
        return { data: { value } };
      }
      // Type 6: Lead Status → normalize variations like
      case DASHBOARD_ANALYTICS_TYPE.LEAD_STATUS:
      case 6: {
        // Normalize in aggregation (before grouping)
        pipeline.push({
          $addFields: {
            normalizedLeadStatus: {
              $switch: {
                branches: [
                  {
                    // Interested Task family
                    case: {
                      $eq: [
                        {
                          $replaceAll: {
                            input: {
                              $replaceAll: {
                                input: { $toLower: "$leadStatus" },
                                find: "-",
                                replacement: "",
                              },
                            },
                            find: " ",
                            replacement: "",
                          },
                        },
                        "interestedtask",
                      ],
                    },
                    then: "Interested - Task",
                  },
                  {
                    // Interested Meeting family
                    case: {
                      $eq: [
                        {
                          $replaceAll: {
                            input: {
                              $replaceAll: {
                                input: { $toLower: "$leadStatus" },
                                find: "-",
                                replacement: "",
                              },
                            },
                            find: " ",
                            replacement: "",
                          },
                        },
                        "interestedmeeting",
                      ],
                    },
                    then: "Interested - Meeting",
                  },
                ],
                default: "$leadStatus",
              },
            },
          },
        });

        // If filtering by status (like "Interested - Task")
        if (statusFilter) {
          const normalizedFilter = statusFilter
            .toLowerCase()
            .replace(/[-\s]/g, "");

          pipeline.push({
            $match: {
              $expr: {
                $eq: [
                  {
                    $replaceAll: {
                      input: {
                        $replaceAll: {
                          input: { $toLower: "$normalizedLeadStatus" },
                          find: "-",
                          replacement: "",
                        },
                      },
                      find: " ",
                      replacement: "",
                    },
                  },
                  normalizedFilter,
                ],
              },
            },
          });
        }

        pipeline.push(
          { $group: { _id: "$normalizedLeadStatus", count: { $sum: 1 } } },
          { $project: { _id: 0, name: "$_id", count: 1 } }
        );

        const res = await Calls.aggregate(pipeline);

        // Maintain LEAD_STATUS ordering
        const result = LEAD_STATUS.map((status) => {
          const found = res.find((r: any) => r.name === status);
          return { name: status, count: Number(found?.count ?? 0) };
        });

        // If statusFilter applied, return only that one
        if (statusFilter) {
          const normalizedFilter = statusFilter
            .toLowerCase()
            .replace(/[-\s]/g, "");
          return {
            data: result.filter(
              (r) =>
                r.name.toLowerCase().replace(/[-\s]/g, "") === normalizedFilter
            ),
          };
        }

        return { data: result };
      }

      // Type 7: Call Pickup Status -> group by pickupCalls / notPickupCalls / failedCalls
      case DASHBOARD_ANALYTICS_TYPE.CALL_PICKUP_STATUS:
      case 7: {
        const SUCCESS = [
          "agent_hangup",
          "silence_timeout",
          "user_hangup",
          "max_duration_reached",
          "user_ended_call",
          "max_duration_exceeded",
          "agent_ended_call",
        ];

        const UN_SUCCESS = [
          "dial_busy",
          "dial_failed",
          "dial_no_answer",
          "error_no_audio_received",
          "inactivity",
          "invalid_destination",
          "telephony_provider_permission_denied",
          "telephony_provider_unavailable",
          "voicemail_reached",
          "voicemail_detected",
          "customer-did-not-answer",
          "twilio_error",
          "vonage_error",
          "connection_error",
          "not_connected",
          "call.in-progress.error-vapifault-worker-died",
          "twilio-reported-customer-misdialed",
          "error_asr",
        ];

        pipeline.push(
          {
            $addFields: {
              pickupGroup: {
                $switch: {
                  branches: [
                    {
                      case: { $in: ["$disconnectionReason", SUCCESS] },
                      then: "pickupCalls",
                    },
                    {
                      case: { $in: ["$disconnectionReason", UN_SUCCESS] },
                      then: "notPickupCalls",
                    },
                  ],
                  default: "failedCalls",
                },
              },
            },
          },
          {
            $group: { _id: "$pickupGroup", count: { $sum: 1 } },
          },
          {
            $project: { _id: 0, name: "$_id", count: 1 },
          }
        );

        const res = await Calls.aggregate(pipeline);

        // Always return all three groups in this order (with 0 if missing)
        const GROUPS = ["pickupCalls", "notPickupCalls", "failedCalls"];
        const result = GROUPS.map((g) => {
          const found = res.find((r: any) => r.name === g);
          return { name: g, count: Number(found?.count ?? 0) };
        });

        return { data: result };
      }

      case DASHBOARD_ANALYTICS_TYPE.TOTAL_ATTEMPTS:
      case 8: {
        // Count unique toNumber across entire range
        const uniqueCallsPipeline = [
          ...pipeline,
          {
            $group: {
              _id: "$toNumber", // Only group by toNumber, not by date
            },
          },
          {
            $count: "totalCalls",
          },
        ];

        const uniqueCallsRes = await Calls.aggregate(uniqueCallsPipeline);
        const totalUniqueCalls = uniqueCallsRes[0]?.totalCalls ?? 0;

        // Count total attempts (all calls including duplicates)
        const totalAttemptsPipeline = [
          ...pipeline,
          { $count: "totalAttempts" },
        ];

        const attemptsRes = await Calls.aggregate(totalAttemptsPipeline);
        const totalAttempts = attemptsRes[0]?.totalAttempts ?? 0;

        // Calculate average attempts per unique call
        const avgPerCall =
          totalUniqueCalls > 0
            ? parseFloat((totalAttempts / totalUniqueCalls).toFixed(2))
            : 0;

        console.log("🎯 TOTAL ATTEMPTS ANALYTICS");
        console.log("================================================");
        console.log("📊 Stats:");
        console.log("  Unique Calls (across range):", totalUniqueCalls);
        console.log("  Total Attempts:", totalAttempts);
        console.log("  Average Attempts per Call:", avgPerCall);
        console.log(
          "  Calculation:",
          `${totalAttempts} / ${totalUniqueCalls} = ${avgPerCall}`
        );
        console.log("================================================\n");

        return {
          data: {
            value: totalAttempts,
            avgPerCall: avgPerCall,
          },
        };
      }

      // Type 9: Answered Calls with answer rate and comparison
      case DASHBOARD_ANALYTICS_TYPE.ANSWERED_CALLS:
      case 9: {
        // === CURRENT PERIOD ===
        // Get total calls count (attempts)
        const totalCallsPipeline = [...pipeline, { $count: "totalCalls" }];
        const totalCallsRes = await Calls.aggregate(totalCallsPipeline);
        const totalCalls = totalCallsRes[0]?.totalCalls ?? 0;

        // Get answered calls count (attempts)
        const answeredPipeline = [
          ...pipeline,
          {
            $match: {
              // leadStatus: { $in: ANSWERED_LEAD_STATUSES },
              disconnectionReason: { $in: ANSWER_CALLS },
              //duration: { $gte: 2000 }, // Only count as answered if duration >= 2 seconds (to filter out quick hangups)

            },
          },
          { $count: "answeredCalls" },
        ];

        const answeredRes = await Calls.aggregate(answeredPipeline);
        const answeredCalls = answeredRes[0]?.answeredCalls ?? 0;

        // Calculate current answer rate
        const answerRate =
          totalCalls > 0
            ? ((answeredCalls / totalCalls) * 100).toFixed(2)
            : "0.00";

        // === PREVIOUS PERIOD ===
        const { previousRange } = getComparisonRanges(startDate, endDate);

        // Build previous period base match
        const previousMatch: any = {
          createdAt: {
            $gte: previousRange.start,
            $lte: previousRange.end,
          },
        };

        if (selectedUserId) {
          previousMatch.createdBy = new Types.ObjectId(selectedUserId);
        }

        if (agentId) {
          previousMatch.agentId = agentId;
        }

        // Get previous answered calls count (attempts)
        const previousAnsweredPipeline = [
          { $match: previousMatch },
          {
            $match: {
              leadStatus: { $in: ANSWERED_LEAD_STATUSES },
            },
          },
          { $count: "answeredCalls" },
        ];

        const previousAnsweredRes = await Calls.aggregate(
          previousAnsweredPipeline
        );
        const previousAnsweredCalls =
          previousAnsweredRes[0]?.answeredCalls ?? 0;

        // Calculate comparison percentage with cap at ±100%
        let comparedValue = "+0%";

        if (previousAnsweredCalls === 0 && answeredCalls > 0) {
          comparedValue = "+100%";
        } else if (previousAnsweredCalls > 0 && answeredCalls === 0) {
          comparedValue = "-100%";
        } else if (previousAnsweredCalls > 0) {
          const difference = answeredCalls - previousAnsweredCalls;
          let percentage = (difference / previousAnsweredCalls) * 100;

          const rawPercentage = percentage;

          // Cap at ±100%
          if (percentage > 100) {
            percentage = 100;
          } else if (percentage < -100) {
            percentage = -100;
          }

          const sign = percentage >= 0 ? "+" : "";

          // Format: if it's exactly ±100, show without decimals
          if (percentage === 100 || percentage === -100) {
            comparedValue = `${sign}${Math.abs(percentage)}%`;
          } else {
            comparedValue = `${sign}${percentage.toFixed(2)}%`;
          }
        }

        console.log("📞 ANSWERED CALLS ANALYTICS - Comparison Calculation");
        console.log("================================================");
        console.log("📅 Date Ranges:");
        console.log("  Current Period:", {
          start: currentRange.start,
          end: currentRange.end,
        });
        console.log("  Previous Period:", {
          start: previousRange.start,
          end: previousRange.end,
        });
        console.log("\n📊 Current Period Stats:");
        console.log("  Total Calls (Attempts):", totalCalls);
        console.log("  Answered Calls:", answeredCalls);
        console.log("  Answer Rate:", `${answerRate}%`);
        console.log(
          "  Calculation:",
          `(${answeredCalls} / ${totalCalls}) × 100 = ${answerRate}%`
        );
        console.log("\n📈 Comparison:");
        console.log("  Previous Answered Calls:", previousAnsweredCalls);
        console.log("  Current Answered Calls:", answeredCalls);

        if (previousAnsweredCalls === 0 && answeredCalls > 0) {
          console.log("  Formula: Previous was 0, current > 0");
          console.log("  Result:", comparedValue);
        } else if (previousAnsweredCalls > 0 && answeredCalls === 0) {
          console.log("  Formula: Previous > 0, current = 0");
          console.log("  Result:", comparedValue);
        } else if (previousAnsweredCalls > 0) {
          const difference = answeredCalls - previousAnsweredCalls;
          const rawPercentage = (difference / previousAnsweredCalls) * 100;
          console.log("  Formula: ((Current - Previous) / Previous) × 100");
          console.log(
            `  Calculation: ((${answeredCalls} - ${previousAnsweredCalls}) / ${previousAnsweredCalls}) × 100`
          );
          console.log(
            `  Step 1: ${answeredCalls} - ${previousAnsweredCalls} = ${difference}`
          );
          console.log(
            `  Step 2: ${difference} / ${previousAnsweredCalls} = ${(difference / previousAnsweredCalls).toFixed(4)}`
          );
          console.log(
            `  Step 3: ${(difference / previousAnsweredCalls).toFixed(4)} × 100 = ${rawPercentage.toFixed(2)}`
          );
          if (rawPercentage > 100 || rawPercentage < -100) {
            console.log(
              `  Step 4: Capping ${rawPercentage.toFixed(2)}% to ${comparedValue}`
            );
          }
          console.log("  Result:", comparedValue);
        }

        console.log("\n✅ Final Response:", {
          value: answeredCalls,
          answerRate: `${answerRate}%`,
          comparedValue,
        });
        console.log("================================================\n");

        return {
          data: {
            value: answeredCalls,
            answerRate: `${answerRate}%`,
            comparedValue: comparedValue,
          },
        };
      }

      case DASHBOARD_ANALYTICS_TYPE.NO_ANSWER_CALLS:
      case 10: {
        // Get total calls count
        const totalCallsPipeline = [...pipeline, { $count: "totalCalls" }];
        const totalCallsRes = await Calls.aggregate(totalCallsPipeline);
        const totalCalls = totalCallsRes[0]?.totalCalls ?? 0;

        // Get no answer calls count
        const noAnswerPipeline = [
          ...pipeline,
          {
            $match: {
              //leadStatus: { $in: NO_ANSWER_LEAD_STATUSES },
              disconnectionReason: { $in: NO_ANSWER_CALLS },
            },
          },
          { $count: "noAnswerCalls" },
        ];

        const noAnswerRes = await Calls.aggregate(noAnswerPipeline);
        const noAnswerCalls = noAnswerRes[0]?.noAnswerCalls ?? 0;

        // Calculate no answer rate percentage
        const noAnswerRate =
          totalCalls > 0
            ? ((noAnswerCalls / totalCalls) * 100).toFixed(2)
            : "0.00";

        console.log("❌ NO ANSWER CALLS ANALYTICS");
        console.log("================================================");
        console.log("📊 Stats:");
        console.log("  Total Calls:", totalCalls);
        console.log("  No Answer Calls:", noAnswerCalls);
        console.log("  No Answer Rate:", `${noAnswerRate}%`);
        console.log(
          "  Calculation:",
          `(${noAnswerCalls} / ${totalCalls}) × 100 = ${noAnswerRate}%`
        );
        console.log("================================================\n");

        return {
          data: {
            value: noAnswerCalls,
            noAnswerRate: `${noAnswerRate}%`,
          },
        };
      }

      case DASHBOARD_ANALYTICS_TYPE.AVG_DURATION:
      case 11: {
        // First group: sum duration per toNumber (across entire range)
        const durationPipeline = [
          ...pipeline,
          {
            $group: {
              _id: "$toNumber", // Only group by toNumber
              totalDurationMs: { $sum: { $ifNull: ["$duration", 0] } },
            },
          },
          {
            $group: {
              _id: null,
              totalDurationMs: { $sum: "$totalDurationMs" },
              totalUniqueCalls: { $sum: 1 },
            },
          },
        ];

        const durationRes = await Calls.aggregate(durationPipeline);
        const totalDurationMs = durationRes[0]?.totalDurationMs ?? 0;
        const totalUniqueCalls = durationRes[0]?.totalUniqueCalls ?? 0;

        // Convert milliseconds to seconds
        const totalDurationSeconds = totalDurationMs / 1000;

        // Calculate average duration in seconds
        const avgDurationSeconds =
          totalUniqueCalls > 0 ? totalDurationSeconds / totalUniqueCalls : 0;

        // Format as MM:SS
        const minutes = Math.floor(avgDurationSeconds / 60);
        const seconds = Math.round(avgDurationSeconds % 60);
        const formattedDuration = `${minutes}:${seconds.toString().padStart(2, "0")}`;

        console.log("⏱️ AVG DURATION ANALYTICS (Unique Calls Across Range)");
        console.log("================================================");
        console.log("📊 Stats:");
        console.log("  Unique Calls (across range):", totalUniqueCalls);
        console.log("  Total Duration (ms):", totalDurationMs);
        console.log(
          "  Total Duration (seconds):",
          totalDurationSeconds.toFixed(2)
        );
        console.log(
          "  Average Duration (seconds):",
          avgDurationSeconds.toFixed(2)
        );
        console.log("  Formatted Duration:", formattedDuration);
        console.log(
          "  Calculation:",
          `${totalDurationSeconds.toFixed(2)} / ${totalUniqueCalls} = ${avgDurationSeconds.toFixed(2)} seconds`
        );
        console.log("================================================\n");

        return {
          data: {
            value: formattedDuration,
            seconds: parseFloat(avgDurationSeconds.toFixed(1)),
          },
        };
      }

      // Type 12: Success Rate (meetings booked + interested in meeting) with comparison
      case DASHBOARD_ANALYTICS_TYPE.SUCCESS_RATE:
      case 12: {
        // === CURRENT PERIOD ===
        // Get UNIQUE calls count (grouped by toNumber across entire range)
        const uniqueCallsPipeline: any[] = [
          { $match: baseMatch },
          {
            $group: {
              _id: "$toNumber", // Only group by toNumber
            },
          },
          {
            $count: "totalCalls",
          },
        ];

        const totalCallsRes = await Calls.aggregate(uniqueCallsPipeline);
        const totalUniqueCalls = totalCallsRes[0]?.totalCalls ?? 0;

        // Get SUCCESS calls count (group by toNumber, take last status)
        const successCallsPipeline: any[] = [
          { $match: baseMatch },
          {
            $sort: { createdAt: 1 }, // Sort by date to get the latest status
          },
          {
            $group: {
              _id: "$toNumber", // Only group by toNumber
              lastLeadStatus: { $last: "$leadStatus" }, // Take the last/latest status
            },
          },
          {
            $match: {
              lastLeadStatus: { $in: SUCCESS_STATUSES },
            },
          },
          {
            $count: "successCalls",
          },
        ];

        const successCallsRes = await Calls.aggregate(successCallsPipeline);
        const successCalls = successCallsRes[0]?.successCalls ?? 0;

        // Calculate current success rate (with 1 decimal place)
        const successRate =
          totalUniqueCalls > 0
            ? ((successCalls / totalUniqueCalls) * 100).toFixed(1)
            : "0.0";

        // === PREVIOUS PERIOD ===
        const { previousRange } = getComparisonRanges(startDate, endDate);

        // Build previous period base match
        const previousMatch: any = {
          createdAt: {
            $gte: previousRange.start,
            $lte: previousRange.end,
          },
        };

        if (selectedUserId) {
          previousMatch.createdBy = new Types.ObjectId(selectedUserId);
        }

        if (agentId) {
          previousMatch.agentId = agentId;
        }

        // Get previous SUCCESS calls count (unique across range)
        const previousSuccessPipeline: any[] = [
          { $match: previousMatch },
          {
            $sort: { createdAt: 1 },
          },
          {
            $group: {
              _id: "$toNumber", // Only group by toNumber
              lastLeadStatus: { $last: "$leadStatus" },
            },
          },
          {
            $match: {
              lastLeadStatus: { $in: SUCCESS_STATUSES },
            },
          },
          {
            $count: "successCalls",
          },
        ];

        const previousSuccessRes = await Calls.aggregate(
          previousSuccessPipeline
        );
        const previousSuccessCalls = previousSuccessRes[0]?.successCalls ?? 0;

        // Calculate comparison percentage with cap at ±100%
        let comparedValue = "+0%";

        if (previousSuccessCalls === 0 && successCalls > 0) {
          comparedValue = "+100%";
        } else if (previousSuccessCalls > 0 && successCalls === 0) {
          comparedValue = "-100%";
        } else if (previousSuccessCalls > 0) {
          const difference = successCalls - previousSuccessCalls;
          let percentage = (difference / previousSuccessCalls) * 100;

          const rawPercentage = percentage;

          // Cap at ±100%
          if (percentage > 100) {
            percentage = 100;
          } else if (percentage < -100) {
            percentage = -100;
          }

          const sign = percentage >= 0 ? "+" : "";

          // Format: if it's exactly ±100, show without decimals
          if (percentage === 100 || percentage === -100) {
            comparedValue = `${sign}${Math.abs(percentage)}%`;
          } else {
            comparedValue = `${sign}${percentage.toFixed(2)}%`;
          }
        }

        console.log("✅ SUCCESS RATE ANALYTICS - Comparison Calculation");
        console.log("================================================");
        console.log("📅 Date Ranges:");
        console.log("  Current Period:", {
          start: currentRange.start,
          end: currentRange.end,
        });
        console.log("  Previous Period:", {
          start: previousRange.start,
          end: previousRange.end,
        });
        console.log("\n📊 Current Period Stats:");
        console.log("  Total Unique Calls (across range):", totalUniqueCalls);
        console.log(
          "  Success Count (Meeting Booked + Interested):",
          successCalls
        );
        console.log(
          "  Raw Success Rate:",
          (successCalls / totalUniqueCalls) * 100
        );
        console.log("  Success Rate (formatted):", `${successRate}%`);
        console.log(
          "  Calculation:",
          `(${successCalls} / ${totalUniqueCalls}) × 100 = ${successRate}%`
        );
        console.log("\n📈 Comparison:");
        console.log("  Previous Success Count:", previousSuccessCalls);
        console.log("  Current Success Count:", successCalls);

        if (previousSuccessCalls === 0 && successCalls > 0) {
          console.log("  Formula: Previous was 0, current > 0");
          console.log("  Result:", comparedValue);
        } else if (previousSuccessCalls > 0 && successCalls === 0) {
          console.log("  Formula: Previous > 0, current = 0");
          console.log("  Result:", comparedValue);
        } else if (previousSuccessCalls > 0) {
          const difference = successCalls - previousSuccessCalls;
          const rawPercentage = (difference / previousSuccessCalls) * 100;
          console.log("  Formula: ((Current - Previous) / Previous) × 100");
          console.log(
            `  Calculation: ((${successCalls} - ${previousSuccessCalls}) / ${previousSuccessCalls}) × 100`
          );
          console.log(
            `  Step 1: ${successCalls} - ${previousSuccessCalls} = ${difference}`
          );
          console.log(
            `  Step 2: ${difference} / ${previousSuccessCalls} = ${(difference / previousSuccessCalls).toFixed(4)}`
          );
          console.log(
            `  Step 3: ${(difference / previousSuccessCalls).toFixed(4)} × 100 = ${rawPercentage.toFixed(2)}`
          );
          if (rawPercentage > 100 || rawPercentage < -100) {
            console.log(
              `  Step 4: Capping ${rawPercentage.toFixed(2)}% to ${comparedValue}`
            );
          }
          console.log("  Result:", comparedValue);
        }

        console.log("\n✅ Final Response:", {
          value: `${successRate}%`,
          successCalls,
          comparedValue,
        });
        console.log("================================================\n");

        return {
          data: {
            value: `${successRate}%`,
            meetingsBooked: successCalls,
            comparedValue: comparedValue,
          },
        };
      }

      case DASHBOARD_ANALYTICS_TYPE.LEAD_STATUS_DISTRIBUTION:
      case 13: {

        const statusPipeline = [
          ...pipeline,
          { $sort: { createdAt: 1 } },
          {
            $group: {
              _id: "$toNumber",
              lastLeadStatus: { $last: "$leadStatus" },
            },
          },
          {
            $addFields: {
              normalizedLeadStatus: {
                $switch: {
                  branches: [
                    {
                      case: {
                        $eq: [
                          {
                            $replaceAll: {
                              input: {
                                $replaceAll: {
                                  input: { $toLower: "$lastLeadStatus" },
                                  find: "-",
                                  replacement: "",
                                },
                              },
                              find: " ",
                              replacement: "",
                            },
                          },
                          "interestedtask",
                        ],
                      },
                      then: "Interested - Task",
                    },
                    {
                      case: {
                        $eq: [
                          {
                            $replaceAll: {
                              input: {
                                $replaceAll: {
                                  input: { $toLower: "$lastLeadStatus" },
                                  find: "-",
                                  replacement: "",
                                },
                              },
                              find: " ",
                              replacement: "",
                            },
                          },
                          "interestedmeeting",
                        ],
                      },
                      then: "Interested - Meeting",
                    },
                  ],
                  default: "$lastLeadStatus",
                },
              },
            },
          },
          {
            $group: {
              _id: "$normalizedLeadStatus",
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              status: "$_id",
              count: 1,
            },
          },
        ];

        const statusRes = await Calls.aggregate(statusPipeline);

        // ===== TOTAL UNIQUE CALLS =====
        const totalCallsPipeline = [
          ...pipeline,
          { $group: { _id: "$toNumber" } },
          { $count: "totalCalls" },
        ];

        const totalCallsRes = await Calls.aggregate(totalCallsPipeline);
        const totalCalls = totalCallsRes[0]?.totalCalls ?? 0;

        // ===== SELECT CONFIG BASED ON COMPANY =====
        console.log("🔍 User Details for Lead Status Distribution:", userDetails);
        const STATUS_LIST = LEAD_STATUSES_COMMONS;

        // ===== NORMALIZE DB DATA =====
        const normalizedMap: {
          [key: string]: { original: string; count: number };
        } = {};

        statusRes.forEach((item: any) => {
          const normalizedKey = item.status
            ?.toLowerCase()
            .replace(/[-–\s]/g, "");

          normalizedMap[normalizedKey] = {
            original: item.status,
            count: item.count,
          };
        });

        let finalList: any[] = [];

        // ===== CASE 1: NO DATA =====
        if (!statusRes || statusRes.length === 0) {
          finalList = STATUS_LIST.map((name, index) => ({
            _id: index + 1,
            name,
            count: 0,
            percentage: 0,
          }));
        }

        // ===== CASE 2: DATA EXISTS (MERGE DB + MISSING CONFIG) =====
        else {
          finalList = STATUS_LIST.map((name, index) => {
            const normalizedStatus = name
              .toLowerCase()
              .replace(/[-–\s]/g, "");

            const dbItem = normalizedMap[normalizedStatus];

            const count = dbItem?.count || 0;

            const percentage =
              totalCalls > 0
                ? parseFloat(((count / totalCalls) * 100).toFixed(1))
                : 0;

            return {
              _id: index + 1,
              name,
              count,
              percentage,
            };
          });
        }

        // ===== LOG =====
        console.log("📊 LEAD STATUS DISTRIBUTION (FINAL)");
        console.log("================================================");
        console.log("📈 Total UNIQUE Calls:", totalCalls);
        console.log("\n📋 Distribution:");
        finalList.forEach((item) => {
          console.log(`  ${item.name}:`, item.count, `(${item.percentage}%)`);
        });
        console.log("================================================\n");

        return {
          data: finalList,
        };
      }

      default:
        throw new Error("Invalid analytics type");
    }
  }

  // Convenience wrappers (unchanged)
  public static async getTotalCallsStats(
    startDate: string,
    endDate: string,
    selectedUserId: string,
    agentId?: string
  ) {

    return this.getAnalytics(
      startDate,
      endDate,
      DASHBOARD_ANALYTICS_TYPE.TOTAL_CALL,
      [],
      "",
      selectedUserId,
      "",
      agentId,
    );
  }

  // Convenience wrappers (unchanged)
  public static async getTotalAttemptsStats(
    startDate: string,
    endDate: string,
    selectedUserId: string,
    agentId?: string
  ) {
    return this.getAnalytics(
      startDate,
      endDate,
      DASHBOARD_ANALYTICS_TYPE.TOTAL_ATTEMPTS,
      [],
      "",
      selectedUserId,
      "",
      agentId
    );
  }

  // Convenience wrappers (unchanged)
  public static async getTotalAnsweredStats(
    startDate: string,
    endDate: string,
    selectedUserId: string,
    agentId?: string
  ) {
    return this.getAnalytics(
      startDate,
      endDate,
      DASHBOARD_ANALYTICS_TYPE.ANSWERED_CALLS,
      [],
      "",
      selectedUserId,
      "",
      agentId
    );
  }

  public static async getTotalNoAnsweredStats(
    startDate: string,
    endDate: string,
    selectedUserId: string,
    agentId?: string
  ) {
    return this.getAnalytics(
      startDate,
      endDate,
      DASHBOARD_ANALYTICS_TYPE.NO_ANSWER_CALLS,
      [],
      "",
      selectedUserId,
      "",
      agentId
    );
  }

  public static async getAvgDurationStats(
    startDate: string,
    endDate: string,
    selectedUserId: string,
    agentId?: string
  ) {
    return this.getAnalytics(
      startDate,
      endDate,
      DASHBOARD_ANALYTICS_TYPE.AVG_DURATION,
      [],
      "",
      selectedUserId,
      "",
      agentId
    );
  }

  public static async getSuccessStats(
    startDate: string,
    endDate: string,
    selectedUserId: string,
    agentId?: string
  ) {
    return this.getAnalytics(
      startDate,
      endDate,
      DASHBOARD_ANALYTICS_TYPE.SUCCESS_RATE,
      [],
      "",
      selectedUserId,
      "",
      agentId
    );
  }

  public static async getLeadStatusGroupStats(
    startDate: string,
    endDate: string,
    selectedUserId: string,
    agentId?: string
  ) {
    const userDetails = await User.findOne({ _id: selectedUserId }); // Ensure user exists
    return this.getAnalytics(
      startDate,
      endDate,
      DASHBOARD_ANALYTICS_TYPE.LEAD_STATUS_DISTRIBUTION,
      [],
      "",
      selectedUserId,
      "",
      agentId,
      userDetails
    );
  }

  public static async getDurationStats(
    startDate: string,
    endDate: string,
    selectedUserId: string,
    agentId?: string
  ) {
    return this.getAnalytics(
      startDate,
      endDate,
      DASHBOARD_ANALYTICS_TYPE.TOTAL_DURATION,
      [],
      "",
      selectedUserId,
      "",
      agentId
    );
  }

  public static async getCostStats(
    startDate: string,
    endDate: string,
    selectedUserId: string,
    agentId?: string
  ) {
    return this.getAnalytics(
      startDate,
      endDate,
      DASHBOARD_ANALYTICS_TYPE.TOTAL_COST,
      [],
      "",
      selectedUserId,
      "",
      agentId
    );
  }

  public static async getStatusStats(
    startDate: string,
    endDate: string,
    statusCodes: number[],
    fieldKey: string,
    selectedUserId: string,
    agentId?: string
  ) {
    const analyticsType =
      statusCodes.includes(CALL_STATUS.FAILED) ||
        statusCodes.includes(CALL_STATUS.ERROR)
        ? DASHBOARD_ANALYTICS_TYPE.FAILED_CALLS
        : DASHBOARD_ANALYTICS_TYPE.ENDED_CALLS;

    return this.getAnalytics(
      startDate,
      endDate,
      analyticsType,
      statusCodes,
      fieldKey,
      selectedUserId,
      "",
      agentId
    );
  }

  public static async getLeadStatusStats(
    startDate: string,
    endDate: string,
    selectedUserId: string,
    statusFilter?: string,
    agentId?: string
  ) {
    return this.getAnalytics(
      startDate,
      endDate,
      DASHBOARD_ANALYTICS_TYPE.LEAD_STATUS,
      [],
      "",
      selectedUserId,
      statusFilter,
      agentId
    );
  }

  public static async getCallPickupStatusStats(
    startDate: string,
    endDate: string,
    selectedUserId: string,
    agentId?: string
  ) {
    return this.getAnalytics(
      startDate,
      endDate,
      DASHBOARD_ANALYTICS_TYPE.CALL_PICKUP_STATUS,
      [],
      "",
      selectedUserId,
      "",
      agentId
    );
  }
}
