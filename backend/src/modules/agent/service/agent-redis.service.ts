import { getRedisClient } from "../../../database/mongo-connect";

export class UserAgentValidationService {
  private readonly REDIS_PREFIX = "user_agent:validation:";

  /**
   * Clear validation cache by agentObjectId (Agent's _id)
   * @param companyId - Company ID
   * @param agentObjectId - MongoDB ObjectId of the agent as string
   */
  async clearValidationCacheByAgentObjectId(
    companyId: string,
    agentObjectId: string
  ): Promise<void> {
    try {
      const redis = getRedisClient();

      // Direct key construction
      const key = `${this.REDIS_PREFIX}${companyId}:${agentObjectId}`;

      const result = await redis.del(key);

      if (result === 1) {
        console.log(`Validation cache cleared: ${key}`);
      } else {
        console.log(`No validation cache found for key: ${key}`);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error clearing validation cache:", error.message);
      } else {
        console.error("Unknown error clearing validation cache:", error);
      }
    }
  }
}

export const userAgentValidationService = new UserAgentValidationService();