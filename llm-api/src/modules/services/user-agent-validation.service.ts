import { Agent } from "../models/agent.model";
import { UserAgent } from "../models/user-agent.model";
import { getRedisClient } from "../../database/mongo-connection";

interface UserAgentValidation {
  companyId: string;
  agentIdString: string;
  agentObjectId?: string;
  isValid: boolean;
}

export class UserAgentValidationService {
  private readonly REDIS_PREFIX = "user_agent:validation:";
  private readonly REDIS_TTL = 300;

  private async getValidationFromRedis(
    companyId: string,
    agentIdString: string
  ): Promise<UserAgentValidation | null> {
    try {
      const redis = getRedisClient();
      const redisKey = `${this.REDIS_PREFIX}${companyId}:${agentIdString}`;
      const cachedData = await redis.get(redisKey);

      if (cachedData) {
        console.log(`UserAgent validation loaded from Redis cache: ${companyId}:${agentIdString}`);
        return JSON.parse(cachedData) as UserAgentValidation;
      }

      return null;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Redis fetch error:", error.message);
      } else {
        console.error("Unknown Redis fetch error:", error);
      }
      return null;
    }
  }

  private async getValidationFromDatabase(
    companyId: string,
    agentIdString: string
  ): Promise<UserAgentValidation> {
    try {
      console.log(`Validating UserAgent from DB: ${companyId}:${agentIdString}`);

      // Step 1: Agent collection me agentId string se search 
      const agent = await Agent.findOne({
        agentId: agentIdString,
        isArchived: false
      })
        .sort({ createdAt: -1 })
        .limit(1);

      if (!agent) {
        console.log(`Agent not found with agentId: ${agentIdString}`);
        throw new Error(`Agent not found with agentId: ${agentIdString}`);
      }

      console.log(`Agent found with _id: ${agent._id}`);

      // Step 2: UserAgent collection me companyId aur agent._id
      const userAgent = await UserAgent.findOne({
        companyId: companyId,
        agentId: agent._id
      });

      if (!userAgent) {
        console.log(`UserAgent mapping not found: ${companyId}:${agent._id}`);
        throw new Error(`UserAgent mapping not found for companyId: ${companyId} and agentId: ${agent._id}`);
      }

      const validationResult: UserAgentValidation = {
        companyId,
        agentIdString,
        agentObjectId: agent._id.toString(),
        isValid: true
      };

      const redis = getRedisClient();
      const redisKey = `${this.REDIS_PREFIX}${companyId}:${agentIdString}`;
      await redis.setex(
        redisKey,
        this.REDIS_TTL,
        JSON.stringify(validationResult)
      );

      console.log(`UserAgent validation cached in Redis: ${companyId}:${agentIdString} (agent._id: ${agent._id})`);

      return validationResult;

    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error validating UserAgent:", error.message);
      } else {
        console.error("Unknown error validating UserAgent:", error);
      }
      throw error;
    }
  }

  async validateUserAgent(
    companyId: string,
    agentIdString: string
  ): Promise<UserAgentValidation> {
    try {
      let validation = await this.getValidationFromRedis(companyId, agentIdString);

      if (!validation) {
        validation = await this.getValidationFromDatabase(companyId, agentIdString);
      }

      return validation;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error in validateUserAgent:", error.message);
      } else {
        console.error("Unknown error in validateUserAgent:", error);
      }
      throw error;
    }
  }

  async clearValidationCache(companyId: string, agentIdString: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const redisKey = `${this.REDIS_PREFIX}${companyId}:${agentIdString}`;
      await redis.del(redisKey);
      console.log(`Validation cache cleared: ${companyId}:${agentIdString}`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error clearing validation cache:", error.message);
      } else {
        console.error("Unknown error clearing validation cache:", error);
      }
    }
  }

  async clearCompanyValidationCache(companyId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const pattern = `${this.REDIS_PREFIX}${companyId}:*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`Cleared ${keys.length} validation caches for company: ${companyId}`);
      } else {
        console.log(`No validation caches to clear for company: ${companyId}`);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error clearing company validation cache:", error.message);
      } else {
        console.error("Unknown error clearing company validation cache:", error);
      }
    }
  }

  async clearAllValidationCaches(): Promise<void> {
    try {
      const redis = getRedisClient();
      const pattern = `${this.REDIS_PREFIX}*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`Cleared ${keys.length} validation caches`);
      } else {
        console.log("No validation caches to clear");
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error clearing all validation caches:", error.message);
      } else {
        console.error("Unknown error clearing all validation caches:", error);
      }
    }
  }
}

export const userAgentValidationService = new UserAgentValidationService();