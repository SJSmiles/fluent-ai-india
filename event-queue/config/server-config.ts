export const CALL_STATUS = {
  ONGOING: 1,
  ENDED: 2,
  FAILED: 3,
  PENDING: 4,
};

export const CALL_DIRECTION = {
  OUTBOUND: 1,
  INBOUND: 2,
};

export const BATCH_CALL_STATUS = {
  PENDING: 9,
  DRAFT: 1,
  START_CALLING: 2,
  NOT_STARTED: 3,
  IN_PROCESS: 4,
  COMPLETED: 5,
  FAILED: 6,
  SKIP: 7,
};

export const BATCH_CALL_PROCESS_STATUS = {
  UN_SUCCESS_VALUE: 2,
  SUCCESS_VALUE: 3,
  DEAD: 4,
  MIN_TIME_FOR_SUCCESS: 10,
  SKIP: 5,
  FAILED: 7,
};




export const RECIPIENTS_CALL_ATTEMPT_STATUS = {
  PENDING: 0,
  IN_PROCESS: 1,
  SUCCESS: 2
};



export const RECIPIENTS_CALL_STATUS = {
  PENDING: 1,
  UN_SUCCESS: 2,
  SUCCESS: 3,
  DEAD: 4,
  SKIP: 5,
  IN_PROCESS: 6,
  FAILED: 7
};


// =====================================================
// ✅ DEFAULT PROMPTS
// =====================================================
export const DEFAULT_SUMMARY_PROMPT = `
Summarize the call in 1-2 lines.
Return JSON:
{ "summary": "..." }
`;

export const DEFAULT_LEAD_STATUS_PROMPT = `
Classify lead status ONLY from:
Interested | Not Interested | Callback | Do Not Disturb

Return JSON:
{ "leadStatus": "..." }
`;

export const DEFAULT_ANALYSIS_PROMPT = `
Analyze the conversation and return JSON:

{
  "sentiment": "Positive | Neutral | Negative",
  "nextAction": "call again | send whatsapp | no action",
  "intent": "loan inquiry | support | other"
}
`;


export const enhanceLeadPrompt = (
  basePrompt: string,
  leadStatusArray: string[]
) => {
  const defaultArray = [
    "Interested",
    "Not Interested",
    "Callback",
    "Do Not Disturb"
  ];

  const finalArray = leadStatusArray?.length ? leadStatusArray : defaultArray;

  return `
${basePrompt}

---------------------
STRICT CLASSIFICATION RULES:

Allowed lead statuses:
${finalArray.join(" | ")}

Rules:
- You MUST return ONLY one value from the allowed list above.
- Do NOT create new values.
- Do NOT modify spelling.
- Even if the base prompt suggests something else, you MUST follow this list.

Return JSON ONLY:
{ "leadStatus": "<one_of_allowed_values>" }
`;
};



