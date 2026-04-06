import { Types } from "mongoose";
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
  private readonly REDIS_INVALID_TTL = 60;

  // Helper method to safely get Redis client
  private getRedisClientSafe() {
    try {
      return getRedisClient();
    } catch (error) {
      console.warn("⚠️ Redis not available, using database-only mode");
      return null;
    }
  }

  private async getValidationFromRedis(
    companyId: string,
    agentIdString: string
  ): Promise<UserAgentValidation | null> {
    try {
      const redis = this.getRedisClientSafe();
      if (!redis) return null; // Skip Redis if not available

      const redisKey = `${this.REDIS_PREFIX}${companyId}:${agentIdString}`;
      const cachedData = await redis.get(redisKey);

      if (cachedData) {
        console.log(`✅ UserAgent validation loaded from Redis cache: ${companyId}:${agentIdString}`);
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

  private async cacheValidationResult(
    redisKey: string,
    result: UserAgentValidation,
    ttl: number
  ): Promise<void> {
    try {
      const redis = this.getRedisClientSafe();
      if (!redis) return; // Skip caching if Redis not available

      await redis.setex(redisKey, ttl, JSON.stringify(result));
    } catch (error) {
      console.error("Failed to cache validation result:", error);
      // Continue without caching
    }
  }

  private async getValidationFromDatabase(
    companyId: string,
    agentIdString: string
  ): Promise<UserAgentValidation> {
    try {
      console.log(`📥 Validating UserAgent from DB: ${companyId}:${agentIdString}`);

      // Step 1: Agent collection me agentId string se search karke _id nikalna
      const agent = await Agent.findOne({
        agentId: agentIdString,
        isArchived: false,
        companyId: new Types.ObjectId(companyId)
      })
        .sort({ createdAt: -1 })  // Gets the LATEST one
        .limit(1);

      if (!agent) {
        console.log(`❌ Agent not found with agentId: ${agentIdString}`);

        const invalidResult: UserAgentValidation = {
          companyId,
          agentIdString,
          isValid: false
        };

        // // Cache the invalid result
        // const redisKey = `${this.REDIS_PREFIX}${companyId}:${agentIdString}`;
        // await this.cacheValidationResult(redisKey, invalidResult, this.REDIS_INVALID_TTL);

        return invalidResult;
      }

      console.log(`✅ Agent found with _id: ${agent._id}`);

      // Step 2: UserAgent collection me companyId aur agent._id se search
      const userAgent = await UserAgent.findOne({
        companyId: new Types.ObjectId(companyId),
        agentId: agent._id,
        isArchived: false,
      });

      //const redisKey = `${this.REDIS_PREFIX}${companyId}:${agentIdString}`;

      if (!userAgent) {
        console.log(`❌ UserAgent mapping not found: ${companyId}:${agent._id}`);

        const invalidResult: UserAgentValidation = {
          companyId,
          agentIdString,
          agentObjectId: agent._id.toString(),
          isValid: false
        };

        // await this.cacheValidationResult(redisKey, invalidResult, this.REDIS_INVALID_TTL);

        return invalidResult;
      }

      const validationResult: UserAgentValidation = {
        companyId,
        agentIdString,
        agentObjectId: agent._id.toString(),
        isValid: true
      };

      //await this.cacheValidationResult(redisKey, validationResult, this.REDIS_TTL);

      console.log(`✅ UserAgent validation complete: ${companyId}:${agentIdString} (agent._id: ${agent._id})`);

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
      // // Try Redis first
      // let validation = await this.getValidationFromRedis(companyId, agentIdString);

      // // If not in Redis, get from database
      // if (!validation) {
      const validation = await this.getValidationFromDatabase(companyId, agentIdString);
      //}

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
      const redis = this.getRedisClientSafe();
      if (!redis) {
        console.log("⚠️ Redis not available, skipping cache clear");
        return;
      }

      const redisKey = `${this.REDIS_PREFIX}${companyId}:${agentIdString}`;
      await redis.del(redisKey);
      console.log(`🗑️ Validation cache cleared: ${companyId}:${agentIdString}`);
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
      const redis = this.getRedisClientSafe();
      if (!redis) {
        console.log("⚠️ Redis not available, skipping cache clear");
        return;
      }

      const pattern = `${this.REDIS_PREFIX}${companyId}:*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`🗑️ Cleared ${keys.length} validation caches for company: ${companyId}`);
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
      const redis = this.getRedisClientSafe();
      if (!redis) {
        console.log("⚠️ Redis not available, skipping cache clear");
        return;
      }

      const pattern = `${this.REDIS_PREFIX}*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`🗑️ Cleared ${keys.length} validation caches`);
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