import crypto from 'crypto';
import { Company } from '../../company/models/company.model';
import { Environment } from '../../../config/environment';
import { UserAgent } from '../../agent/model/user-agent.model';
import { Agent } from '../../agent/model/agent.model';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { parsePhoneNumberFromString } from "libphonenumber-js/max";

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0')
});

interface UserConfiguration {
  userId: string;
  companyId: string;
  agentId: string | null;
  outboundNumber: string | null;
  phoneBindings: any[];
  agentPrompt: string | null;
  analysisPrompt: string | null;
  responseEngine: any;
  company: any;
  companyConfiguration: any;
  additionalInfoConfig: any[];
  queueProcessInMinutes: number;
  maxAttempts: number;
  bmbyProjectId: string | null;
  bmbyUserId: string | null;
  voiceProvider: string;
  assistantId: string | null;
  phoneNumberId: string | null;
}

const signatureCache = new Map<string, string>();

export function generateWebhookSignatureOptimized(companyId: string): string {
  const cleanCompanyId = companyId.toString();

  // Check cache first
  const cachedSignature = signatureCache.get(cleanCompanyId);
  if (cachedSignature) {
    return cachedSignature;
  }

  const secretSalt = process.env.WEBHOOK_SECRET_SALT;
  if (!secretSalt) {
    throw new Error('WEBHOOK_SECRET_SALT environment variable is not set');
  }

  const dataToHash = `${cleanCompanyId}${secretSalt}`;
  const signature = crypto.createHash('sha256').update(dataToHash).digest('hex');

  // Cache the signature
  signatureCache.set(cleanCompanyId, signature);
  return signature;
}

export function generateWebhookUrl(companyId: string): string {
  const signature = generateWebhookSignatureOptimized(companyId);

  const baseUrl = Environment.baseUrl;

  if (!baseUrl) {
    throw new Error('BASE_URL environment variable is not set');
  }

  return `${baseUrl}?signature=${signature}`;
}

export async function extractCompanyIdFromSignature(
  receivedSignature: string
): Promise<string | null> {
  try {
    const companies = await Company.find({ isArchived: { $ne: true } }).select('_id');

    if (!companies || companies.length === 0) {
      return null;
    }

    const secretSalt = process.env.WEBHOOK_SECRET_SALT;
    if (!secretSalt) {
      return null;
    }

    for (const company of companies) {
      const companyId = company._id.toString();

      try {
        const dataToHash = `${companyId}${secretSalt}`;
        const expectedSignature = crypto.createHash('sha256').update(dataToHash).digest('hex');

        if (
          crypto.timingSafeEqual(
            Buffer.from(expectedSignature, 'hex'),
            Buffer.from(receivedSignature, 'hex')
          )
        ) {
          return companyId;
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

function getUserConfigCacheKey(userId: string, companyId: string): string {
  return `user_config:${userId}:${companyId}`;
}

async function getUserConfigFromCache(
  userId: string,
  companyId: string
): Promise<UserConfiguration | null> {
  try {
    const cacheKey = getUserConfigCacheKey(userId, companyId);
    const cached = await redis.get(cacheKey);

    if (cached) {
      console.log('User configuration found in Redis cache');
      return JSON.parse(cached) as UserConfiguration;
    }

    console.log(' User configuration not found in cache');
    return null;
  } catch (error: any) {
    console.error('Error reading from Redis cache:', error.message);
    return null;
  }
}

async function saveUserConfigToCache(
  userId: string,
  companyId: string,
  config: UserConfiguration
): Promise<void> {
  try {
    const cacheKey = getUserConfigCacheKey(userId, companyId);
    const ttl = 24 * 60 * 60; // 24 hours in seconds

    await redis.setex(cacheKey, ttl, JSON.stringify(config));
  } catch (error: any) {
    console.error('Error saving to Redis cache:', error.message);
  }
}

export async function invalidateUserConfigCache(
  userId: string,
  companyId: string
): Promise<void> {
  try {
    const cacheKey = getUserConfigCacheKey(userId, companyId);
    await redis.del(cacheKey);
    console.log('🗑️ User configuration cache invalidated');
  } catch (error: any) {
    console.error('Error deleting from Redis cache:', error.message);
  }
}

async function fetchUserConfigFromDB(
  userId: string,
  companyId: string,
  agentId: string
): Promise<UserConfiguration | null> {
  try {

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const companyObjectId = new mongoose.Types.ObjectId(companyId);

    const company = await Company.findById(companyObjectId);

    if (!company) {
      console.error('Company not found');
      return null;
    }

    const user = await mongoose.connection.db.collection('User').findOne({
      _id: userObjectId,
      companyId: companyObjectId
    });

    if (!user) {
      console.error('User not found');
      return null;
    }

    // ✅ Get primary voice provider from voiceProviders array
    const companyObj = company.toObject();
    const voiceProvider = getPrimaryVoiceProviderFromCompany(companyObj);
    console.log(`🔍 Company voice provider: ${voiceProvider}`);

    let agent = await Agent.findOne({
      companyId: companyObjectId,
      isArchived: false,
      voiceProvider: voiceProvider,
      agentId: agentId
    }).lean();

    console.log(`🔍 Fetching agent for agent ${agent?._id} with agentId ${agentId}`);

    if (!agent) {
      console.error('Agent not found');
      return null;
    }
    const userAgent = await UserAgent.findOne({ agentId: agent?._id, isArchived: false, companyId: companyObjectId, voiceProvider: voiceProvider }).lean();
    console.log(`🔍 Fetching user agent ${userAgent}`);
    if (!userAgent) {
      console.error('Agent not configured for user');
      return null;
    }


    let phoneBindings: any[] = [];
    let agentPrompt: string | null = null;
    let analysisPrompt: string | null = null;
    let responseEngine: any = null;

    if (userAgent?.agentId) {
      console.log(`🔍 Fetching agent with ID: ${userAgent.agentId}`);
      if (agent) {
        console.log(`✅ Agent found with ID: ${agent._id}`);
        console.log(`📋 Available fields:`, Object.keys(agent));

        const agentResponseEngineType = agent.responseEngine?.type || null;
        console.log(`🔍 Agent response engine type: ${agentResponseEngineType}`);

        // ✅ Extract agent data with safe fallbacks
        phoneBindings = agent.phoneBindings || [];
        agentPrompt = agent.agentPrompt || null;

        // Check if analysisPrompt exists, otherwise try postCallAnalysisData or set to null
        analysisPrompt = agent.analysisPrompt ||
          (agent.postCallAnalysisData?.length ? agent.postCallAnalysisData[0] : null) ||
          null;

        responseEngine = agent.responseEngine || null;
      } else {
        console.warn('⚠️  Agent not found in database');
      }
    } else {
      console.warn('⚠️  No agent assigned to this user');
    }

    const companyConfigCollection = mongoose.connection.db.collection('CompanyConfiguration');

    let companyConfiguration = await companyConfigCollection.findOne({
      companyId: companyObjectId,
      type: 'sheet-configuration'
    });

    const additionalInfoConfig = companyConfiguration?.configuration || [];
    const queueProcessInMinutes = companyConfiguration?.queueProcessInMinutes || 3;
    const maxAttempts = companyConfiguration?.maximumAttempts || 3;

    let outboundNumber: string | null = null;
    if (phoneBindings.length) {
      const outboundBinding = phoneBindings.find((pb: any) => pb.direction === 'outbound' || pb.direction === 'both');
      if (outboundBinding) {
        outboundNumber = outboundBinding.number || null;
      }
    }

    // Extract BMBY credentials from User document
    const bmbyProjectId = user.bmbyProjectId || user.projectId || null;
    const bmbyUserId = user.bmbyUserId || user.bmbyId || null;

    // ✅ Get API key for the current voice provider
    const apiKey = getApiKeyForProviderFromCompany(companyObj, voiceProvider);

    const userConfig = {
      userId: userId,
      companyId: companyId,
      agentId: userAgent?.agentId?.toString() || null,
      outboundNumber,
      phoneBindings,
      agentPrompt,
      analysisPrompt,
      responseEngine,
      company: companyObj,
      companyConfiguration: companyConfiguration || null,
      additionalInfoConfig,
      queueProcessInMinutes,
      maxAttempts,
      bmbyProjectId,
      bmbyUserId,
      assistantId: agent?.agentId || null,
      phoneNumberId: agent?.vapiPhoneNumberId || null,
      voiceProvider, // ✅ Voice provider
      apiKey // ✅ Add API key for the current provider
    };

    console.log('✅ User configuration Data:', userConfig);

    return userConfig;

  } catch (error: any) {
    console.error('❌ Error fetching user configuration from DB:', error.message);
    console.log('Error details:', error);
    console.error('Stack trace:', error.stack);
    return null;
  }
}

// ✅ Helper function to get primary voice provider from company object
function getPrimaryVoiceProviderFromCompany(company: any): 'vapi' | 'retell' {
  if (!company?.voiceProviders || !Array.isArray(company.voiceProviders) || company.voiceProviders.length === 0) {
    return 'vapi'; // Default fallback
  }

  const primaryProvider = company.voiceProviders[0]?.name?.toLowerCase();
  return primaryProvider === 'vapi' ? 'vapi' : 'retell';
}

// ✅ Helper function to get API key for a specific provider from company object
function getApiKeyForProviderFromCompany(
  company: any,
  providerName: 'vapi' | 'retell'
): string | null {
  if (!company?.voiceProviders || !Array.isArray(company.voiceProviders)) {
    // Fallback to environment variables
    return providerName === 'vapi'
      ? process.env.VAPI_API_KEY || null
      : process.env.RETELL_API_KEY || null;
  }

  const config = company.voiceProviders.find(
    (vp: any) => vp.name?.toLowerCase() === providerName.toLowerCase()
  );

  if (config?.api_key_id) {
    return config.api_key_id;
  }

  // Fallback to environment variables
  return providerName === 'vapi'
    ? process.env.VAPI_API_KEY || null
    : process.env.RETELL_API_KEY || null;
}

export async function getUserConfiguration(
  userId: string,
  companyId: string,
  agentId: string
): Promise<UserConfiguration | null> {
  try {
    const dbConfig = await fetchUserConfigFromDB(userId, companyId, agentId);

    if (!dbConfig) {
      console.error('User configuration could not be retrieved from database');
      return null;
    }

    console.log('✅ User configuration retrieved from database');
    return dbConfig;


  } catch (error: any) {
    console.error('Error in getUserConfiguration:', error.message);
    return null;
  }
}

export function validateUserConfiguration(config: UserConfiguration): string[] {
  const errors: string[] = [];

  if (!config.company) {
    errors.push('Company not found or inactive');
  }

  if (!config.agentId) {
    errors.push('Agent not configured for user');
  }

  if (!config.outboundNumber) {
    errors.push('Outbound phone number not configured');
  }

  // if (!config.responseEngine) {
  //   errors.push('Agent response engine not configured');
  // }

  // if (config.responseEngine?.type === 'custom-llm' && !config.agentPrompt) {
  //   errors.push('Agent prompt is required for custom LLM');
  // }

  //Validate BMBY credentials
  if (!config.bmbyProjectId) {
    errors.push('BMBY Project ID not configured for user');
  }

  if (!config.bmbyUserId) {
    errors.push('BMBY User ID not configured for user');
  }

  return errors;
}

export function validatePhone(num: string) {
  try {
    const phone = parsePhoneNumberFromString(num);
    return phone?.isValid() && phone?.isPossible();
  } catch {
    return false;
  }
}


export { redis };