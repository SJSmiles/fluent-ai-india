import { getCollection } from './helpers/ApplicationHelper';
import { batchProcessQueue } from './queue/queue';


function throwIf(condition: boolean, message: string) {
  if (condition) throw new Error(message);
}

function log(...args: any[]) {
  console.log(...args);
}

async function fetchById(collection: any, id: any, label: string) {
  const doc = await collection.findOne({ _id: id });
  throwIf(!doc, `${label} not found for ID: ${id}`);
  return doc;
}

export async function run(cronData: any) {
  try {
    const BatchCall = await getCollection("BatchCall");
    const User = await getCollection("User");
    const Company = await getCollection("Company");
    const Agent = await getCollection("Agent");
    const CronJob = await getCollection("CronJob");

    // 1. Fetch BatchCall → User → Company → Agent
    const batchCall = await fetchById(BatchCall, cronData.originalBatchCallId, "BatchCall");
    log(`Found batch call: ${batchCall._id}, createdBy: ${batchCall.createdBy}, agentId: ${batchCall.agentId}`);

    const user = await fetchById(User, batchCall.createdBy, "User");
    log(`Found user: ${user._id}, companyId: ${user.companyId}`);

    const company = await fetchById(Company, user.companyId, "Company");
    log("Company data:", {
      _id: company._id,
      name: company.name,
      voiceProviders: company.voiceProviders,
      voiceProvider: company.voiceProvider
    });

    const agent = await fetchById(Agent, batchCall.agentId, "Agent");

    // -----------------------------
    // 2. Resolve company voice providers
    // -----------------------------
    let companyVoiceProviders: string[] = [];

    if (Array.isArray(company.voiceProviders)) {
      companyVoiceProviders = company.voiceProviders
        .map((vp: any) => vp.name?.toLowerCase())
        .filter(Boolean);

      log("Using new voiceProviders array structure");
    } else if (company.voiceProvider) {
      companyVoiceProviders = [company.voiceProvider.toLowerCase()];
      log("Using old voiceProvider string structure");
    }

    throwIf(
      companyVoiceProviders.length === 0,
      `Company '${company.name}' has no voice providers configured`
    );

    log("📋 Company voice providers:", companyVoiceProviders);

    // -----------------------------
    // 3. Validate Agent’s voice provider
    // -----------------------------
    const agentVoiceProvider = agent.voiceProvider?.toLowerCase();

    throwIf(!agentVoiceProvider, `Agent '${agent.agentName}' has no voice provider configured`);
    throwIf(
      !['vapi', 'retell'].includes(agentVoiceProvider),
      `Invalid agent voice provider: ${agentVoiceProvider}. Must be 'vapi' or 'retell'`
    );
    throwIf(
      !companyVoiceProviders.includes(agentVoiceProvider),
      `Voice provider mismatch: Agent '${agent.agentName}' uses '${agentVoiceProvider}', `
      + `but company '${company.name}' supports only: ${companyVoiceProviders.join(', ')}`
    );

    log(`Voice provider match confirmed: ${agentVoiceProvider}`);

    // -----------------------------
    // 4. Extract API Key from company
    // -----------------------------
    let apiKeyId = null;

    if (Array.isArray(company.voiceProviders)) {
      const config = company.voiceProviders.find(
        (vp: any) => vp.name?.toLowerCase() === agentVoiceProvider
      );
      apiKeyId = config?.api_key_id;
    } else {
      apiKeyId = company.api_key_id; // old structure
    }

    throwIf(!apiKeyId, `No API key found for ${agentVoiceProvider} in company '${company.name}'`);

    log(`API key verified for ${agentVoiceProvider}: ${apiKeyId.substring(0, 8)}...`);

    // -----------------------------
    // 5. Update CronJob with selected API key
    // -----------------------------
    await CronJob.updateOne(
      { _id: cronData._id },
      { $set: { apiKeyId } }
    );

    // -----------------------------
    // 6. Execute service based on provider
    // -----------------------------
    if (agentVoiceProvider === 'vapi') {
      log("Using VAPI service...");

      await batchProcessQueue.add(
        { _id: cronData._id },
        { jobId: `${cronData._id}_${Date.now()}` }
      );
      if (!cronData.followUp) {
        BatchCall.updateOne({
          _id: batchCall?._id
        }, {
          $set: {
            schedule: false
          }
        })
      }
    } else {
      log("Using Retell service...");
    }
    log("Batch call processing completed successfully");
  } catch (error: any) {
    console.error("Error in batch call runner:", error.message);
    console.error("Stack trace:", error.stack);
    throw error;
  }
}
