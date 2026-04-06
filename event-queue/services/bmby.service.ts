import * as crypto from 'crypto';
import { LEAD_STATUS_FOR_TASK_CREATION } from '../config/server-config';

interface BmbyUpdateData {
    callId: any;
    bmby_id: number;
    min_rooms: number | string;
    max_rooms: number | string;
    min_floor: number | string;
    max_floor: number | string;
    budget: string;
    appartment_type: string;
    fname: string;
    lname: string;
    gender: string;
    phone_mobile: string;
    email: string;
    relevant: number;
    country?: string;
    city?: string;
    neighborhood?: string;
    meeting?: any;
    next_attempt?: string;
    action_type?: string;
    nextCallDate?: any;
    taskType?: any;
    leadStatus?: any;
    dynvars?: Array<{
        title_id: number;
        type: string;
        title: string;
        module_id: number;
        value: string;
    }>;
}

interface RoomRange {
    min_room: number | null;
    max_room: number | null;
}


interface FloorRange {
    min_floor: number | null;
    max_floor: number | null;
}

interface BmbyCredentials {
    username: string;
    password: string;
    projectId: string;
    userId: string;
}

// Constants moved to top level for better performance
const IRRELEVANT_STATUSES = new Set([
    "dial_busy",
    "dial_no_answer",
    "voicemail_reached",
    "dial_failed"
]);

const AREAS = [
    { country: "Germany", area: ['Berlin'], neighborhood: ['Charlottenburg', 'WiLmersdorf'] },
    { country: "Cyprus", area: ['Phapos'], neighborhood: ['Yeroskipo'] },
    { country: "United Arab Emirate", area: ['Dubai'], neighborhood: ['Palm Jumeira'] },
];

// Enhanced Purchase Readiness Mapping Class
class PurchaseReadinessMapper {
    private textToIdMap: Map<string, string> | any;
    private idToTextMap: Map<string, { en: string; de: string; category: string }> | any;
    private timeUnits: { [key: string]: number; } | any;
    private immediateTerms: string[] | any;

    constructor() {
        this.initializeMappings();
    }

    private initializeMappings() {
        // Static text to ID mappings (original + extended)
        this.textToIdMap = new Map([
            // German mappings
            ["in den nächsten 3 Monaten", "74916"],
            ["in den nächsten 6 monaten", "74917"],
            ["in den nächsten 6 Monaten", "74917"],
            ["in den nächsten 12 Monaten", "74919"],
            ["in den nächsten 12 monaten", "74919"],
            ["länger als 6 Monate", "74919"],
            ["länger als 6 monate", "74919"],
            ["sofort", "74918"],
            ["3 Monate", "74916"],
            ["6 Monate", "74917"],
            ["12 Monate", "74919"],
            ["nicht besprochen", ""],
            ["Nicht besprochen", ""],

            // English mappings
            ["within the next 3 months", "74916"],
            ["within the next 6 months", "74917"],
            ["within the next 12 months", "74919"],
            ["longer than 6 months", "74919"],
            ["immediately", "74918"],
            ["immediate", "74918"],
            ["3 months", "74916"],
            ["6 months", "74917"],
            ["12 months", "74919"],
            ["not discussed", ""],
            ["Not discussed", ""],
            ["ASAP", "74918"],
            ["asap", "74918"],
            ["as soon as possible", "74918"],
            ["now", "74918"],
            ["jetzt", "74918"],

            // Additional common variants
            ["3 monate", "74916"],
            ["6 monate", "74917"],
            ["more than 6 months", "74919"],
            ["über 6 monate", "74919"],
            ["über 6 Monate", "74919"],
            ["sofortig", "74918"],
            ["right now", "74918"],
            ["urgent", "74918"],
            ["dringend", "74918"]
        ]);

        // Reverse lookup - ID to text mappings
        this.idToTextMap = new Map([
            ["74916", {
                en: "within the next 3 months",
                de: "in den nächsten 3 Monaten",
                category: "3-6 months"
            }],
            ["74917", {
                en: "within the next 6 months",
                de: "in den nächsten 6 Monaten",
                category: "6-12 months"
            }],
            ["74918", {
                en: "immediately",
                de: "sofort",
                category: "immediate"
            }],
            ["74919", {
                en: "longer than 6 months",
                de: "länger als 6 Monate",
                category: "12+ months"
            }],
            ["", {
                en: "not discussed",
                de: "nicht besprochen",
                category: "unknown"
            }]
        ]);

        // Time unit conversion factors to months
        this.timeUnits = {
            // English
            'week': 0.25, 'weeks': 0.25,
            'month': 1, 'months': 1,
            'year': 12, 'years': 12,
            'day': 0.033, 'days': 0.033,

            // German
            'woche': 0.25, 'wochen': 0.25,
            'monat': 1, 'monate': 1, 'monaten': 1,
            'jahr': 12, 'jahre': 12, 'jahren': 12,
            'tag': 0.033, 'tage': 0.033
        };

        // Immediate trigger words
        this.immediateTerms = [
            'immediately', 'immediate', 'now', 'asap', 'as soon as possible',
            'sofort', 'jetzt', 'sofortig', 'right now', 'urgent', 'dringend',
            'today', 'heute', 'this week', 'diese woche'
        ];
    }

    /**
     * Main function to get BMBY ID from any input
     * Logic: < 3 months -> 74918, 3-6 months -> 74916, 6-12 months -> 74917, 12+ months -> 74919
     */
    getId(input: string): string {
        if (!input || typeof input !== 'string') {
            return "";
        }

        const normalizedInput = input.toLowerCase().trim();

        // Check static mappings first (exact matches)
        if (this.textToIdMap.has(input)) {
            return this.textToIdMap.get(input)!;
        }

        if (this.textToIdMap.has(normalizedInput)) {
            return this.textToIdMap.get(normalizedInput)!;
        }

        // Parse dynamic time periods
        const timeInMonths = this.parseTimeToMonths(normalizedInput);

        if (timeInMonths === null) {
            return ""; // Could not parse
        }

        // Apply categorization logic:
        if (timeInMonths < 3) {
            return "74918"; // immediately
        } else if (timeInMonths < 6) {
            return "74916"; // within 3 months
        } else if (timeInMonths <= 12) {
            return "74917"; // within 6 months
        } else {
            return "74919"; // longer than 6 months
        }
    }

    /**
     * Parse time expressions and convert to months
     */
    parseTimeToMonths(input: string): number | null {
        const normalizedInput = input.toLowerCase().trim();

        // Check for immediate terms first
        if (this.immediateTerms.some((term: string) => normalizedInput.includes(term))) {
            return 0; // Immediate = 0 months
        }

        // Try to extract number and time unit
        const patterns = [
            // Standard format: "5 months", "2 years", etc.
            /(\d+(?:\.\d+)?)\s*(week|weeks|month|months|year|years|day|days|woche|wochen|monat|monate|monaten|jahr|jahre|jahren|tag|tage)s?/i,

            // Compact format: "5months", "2years"
            /(\d+(?:\.\d+)?)(week|weeks|month|months|year|years|day|days|woche|wochen|monat|monate|monaten|jahr|jahre|jahren|tag|tage)s?/i,

            // German specific patterns
            /(\d+(?:\.\d+)?)\s*(monate|monaten|jahre|jahren|wochen|tage)/i
        ];

        for (const pattern of patterns) {
            const match = normalizedInput.match(pattern);
            if (match) {
                const value = parseFloat(match[1]);
                const unit = match[2].toLowerCase();
                const multiplier = this.timeUnits[unit];

                if (multiplier !== undefined) {
                    return value * multiplier;
                }
            }
        }

        // Handle standalone numbers (assume months)
        const numberMatch = normalizedInput.match(/^\d+(?:\.\d+)?$/);
        if (numberMatch) {
            return parseFloat(numberMatch[0]);
        }

        // Handle fractional expressions like "half a year", "quarter"
        if (normalizedInput.includes('half') && normalizedInput.includes('year')) {
            return 6;
        }
        if (normalizedInput.includes('quarter') && normalizedInput.includes('year')) {
            return 3;
        }
        if (normalizedInput.includes('halbes jahr')) {
            return 6;
        }

        return null; // Could not parse
    }

    /**
     * Get human-readable text from BMBY ID
     */
    getText(id: string, language: 'en' | 'de' = 'en'): string {
        const mapping = this.idToTextMap.get(id);
        return mapping ? mapping[language] : 'Unknown';
    }
}

// Create singleton instance for purchase readiness mapping
const purchaseReadinessMapper = new PurchaseReadinessMapper();


// Property Type Mappings - Text to BMBY ID
const PROPERTY_TYPE_TEXT_TO_ID = new Map([
    // Residential group - German
    ["residential", "0"],
    ["wohnen", "0"],
    ["wohnimmobilie", "0"],
    ["apartment", "1"],
    ["wohnung", "1"],
    ["eigentumswohnung", "1"],
    ["penthouse", "7"],
    ["penthaus", "7"],
    ["penthouse-wohnung", "7"],
    ["villa", "5"],
    ["einfamilienhaus", "5"],
    ["haus", "5"],
    ["vacation home", "33"],
    ["ferienhaus", "33"],
    ["ferienwohnung", "33"],
    ["urlaubsimmobilie", "33"],
    ["residential building", "18"],
    ["wohngebäude", "18"],
    ["mehrfamilienhaus", "18"],
    ["empty apartment", "1257"],
    ["leere wohnung", "1257"],
    ["unvermietete wohnung", "1257"],
    ["rented apartment", "1258"],
    ["vermietete wohnung", "1258"],
    ["mietwohnung", "1258"],
    ["self use", "1260"],
    ["self-use", "1260"],
    ["selbstnutzung", "1260"],
    ["eigennutzung", "1260"],
    ["short term", "1259"],
    ["kurzfristig", "1259"],
    ["kurzzeitmiete", "1259"],

    // Commercial group - German & English
    ["commercial", "10"],
    ["investment", "10"],
    ["gewerbe", "10"],
    ["gewerbeimmobilie", "10"],
    ["büro", "10"],
    ["office", "10"],
    ["retail", "10"],
    ["einzelhandel", "10"],
    ["home for elderly", "51"],
    ["seniorenheim", "51"],
    ["pflegeheim", "51"],
    ["altenheim", "51"],

    // Additional property types
    ["studio", "1"],
    ["studio-apartment", "1"],
    ["loft", "1"],
    ["maisonette", "1"],
    ["duplex", "1"],
    ["townhouse", "5"],
    ["reihenhaus", "5"],
    ["doppelhaushälfte", "5"],
    ["bungalow", "5"],
    ["land", "34"],
    ["grundstück", "34"],
    ["plot", "34"],
    ["industrial", "11"],
    ["industrie", "11"],
    ["warehouse", "12"],
    ["lager", "12"],
    ["lagerhalle", "12"]
]);

// Property Type Mappings - BMBY ID to Text (for reverse lookup)
const PROPERTY_TYPE_ID_TO_TEXT = new Map([
    ["0", { en: "Residential", de: "Wohnen" }],
    ["1", { en: "Apartment", de: "Wohnung" }],
    ["5", { en: "Villa", de: "Villa" }],
    ["7", { en: "Penthouse", de: "Penthaus" }],
    ["10", { en: "Commercial", de: "Gewerbe" }],
    ["11", { en: "Industrial", de: "Industrie" }],
    ["12", { en: "Warehouse", de: "Lager" }],
    ["18", { en: "Residential Building", de: "Wohngebäude" }],
    ["33", { en: "Vacation Home", de: "Ferienhaus" }],
    ["34", { en: "Land", de: "Grundstück" }],
    ["51", { en: "Home for Elderly", de: "Seniorenheim" }],
    ["1257", { en: "Empty Apartment", de: "Leere Wohnung" }],
    ["1258", { en: "Rented Apartment", de: "Vermietete Wohnung" }],
    ["1259", { en: "Short Term", de: "Kurzfristig" }],
    ["1260", { en: "Self Use", de: "Selbstnutzung" }]
]);



const SOAP_HEADERS = {
    'Content-Type': 'text/xml; charset=utf-8'
} as const;

const BMBY_SOAP_URL = 'https://www.bmby.com/WebServices/srv/v3/';
let calls: any
export const analyzeCallsDataForBmbyUpdate = async (callsToAnalyze: any, callsColl: any, userData: any) => {
    console.log('Starting BMBY call analysis...');
    calls = callsColl;
    const startTime = Date.now();
    let totalCallsAnalyzed = 0;
    let bmbyUpdatesCount = 0;

    try {
        totalCallsAnalyzed = callsToAnalyze.length;
        console.log(`Found ${totalCallsAnalyzed} calls to analyze for BMBY updates`);

        if (totalCallsAnalyzed === 0) {
            return createSuccessResponse(0, 0, []);
        }

        const bmbyUpdates = await processCalls(callsToAnalyze);
        bmbyUpdatesCount = bmbyUpdates.length;

        console.log(`Prepared ${bmbyUpdatesCount} BMBY updates`);

        if (bmbyUpdatesCount > 0) {
            await processBmbyUpdates(bmbyUpdates, userData);
        }

        const processingTime = Date.now() - startTime;
        console.log(`BMBY analysis completed in ${processingTime}ms`);

        return createSuccessResponse(totalCallsAnalyzed, bmbyUpdatesCount, bmbyUpdates);

    } catch (error: any) {
        console.error('Error analyzing calls for BMBY updates:', error);
        return createErrorResponse(error.message);
    }
};

async function processCalls(calls: any[]): Promise<BmbyUpdateData[]> {
    const bmbyUpdates: BmbyUpdateData[] = [];

    for (const call of calls) {
        const analyzedLog = call.callLogsDetails.find((log: any) =>
            log.raw_data?.event === "call_analyzed"
        );

        if (!analyzedLog) continue;

        const callData = analyzedLog.raw_data.call;
        const analysis = callData.call_analysis;
        const bmbyData = extractBmbyData(call, callData, analysis);
        console.log(`Extracted BMBY data for call ID ${call._id}:`, bmbyData);
        bmbyUpdates.push(bmbyData);
    }

    return bmbyUpdates;
}

function extractBmbyData(call: any, callData: any, analysis: any): BmbyUpdateData {
    const customAnalysis = analysis?.custom_analysis_data || {};
    const transcript = callData?.transcript || "";
    const recording = callData?.recording_url || call.recordingUrl || "";
    const callSummary = analysis?.call_summary || "";
    const dataInformation = customAnalysis?.data_information || ""

    // Get purchase readiness with enhanced dynamic parsing
    const timelineValue = customAnalysis?.timeline !== "Nicht besprochen" ? customAnalysis?.timeline : "";
    const purchaseReadinessId = getPurchaseReadinessId(timelineValue);

    const leadStatusId = getLeadStatusId(call?.leadStatus);

    // Create dynvars array
    const dynvars = createDynvars(recording, transcript, callSummary, purchaseReadinessId, leadStatusId, dataInformation);

    // Get apartment type with improved mapping
    const appartmentType = customAnalysis?.purpose
        ? customAnalysis?.purpose : "";
    const appartmentTypeId = getPropertyTypeId(appartmentType);

    // Parse room range
    const room = customAnalysis?.room !== "Nicht besprochen" ? customAnalysis?.room : "";
    const roomRange: any = room ? parseRoomRange(room) : { min_room: null, max_room: null };
    if (roomRange.min_room > 10 || roomRange.max_room > 10) {
        roomRange.max_room = 10.5;
        roomRange.min_room = 10.5;
    }
    const country = call?.country ? call?.country : "";

    // Determine relevance
    const relevant = determineRelevance(call);
    // Get budget
    const budget = customAnalysis.budget !== "Nicht besprochen" ? customAnalysis.budget : "";
    let city: any = customAnalysis.street !== "Nicht besprochen" ? customAnalysis.street : "";
    let neighborhood = customAnalysis.street !== "Nicht besprochen" ? customAnalysis.street : "";
    const areaInfo = AREAS.find(a => a.country === country);

    if (areaInfo) {
        if (city === '' && areaInfo.area.length > 0) {
            city = areaInfo.area[0];
        }
        if (neighborhood === '' && areaInfo.neighborhood.length > 0) {
            neighborhood = areaInfo.neighborhood[0];
        }
    }

    // Parse room range
    const floor = customAnalysis?.floor !== "Nicht besprochen" ? customAnalysis?.floor : "";
    const floorRange = floor ? parseFloorRange(floor) : { min_floor: null, max_floor: null };
    const nextAttempt = customAnalysis?.next_attempt !== "Nicht besprochen" ? customAnalysis?.next_attempt : "";
    const action_type = getActionTypeId(customAnalysis?.activity);
    return {
        action_type: action_type,
        callId: call._id,
        bmby_id: call.bmbyId,
        country,
        min_rooms: roomRange?.min_room ?? "",
        max_rooms: roomRange?.max_room ?? "",
        min_floor: floorRange?.min_floor ?? "",
        max_floor: floorRange?.max_floor ?? "",
        budget,
        city,
        neighborhood,
        appartment_type: appartmentTypeId,
        fname: call?.firstName || '',
        lname: call?.lastName || '',
        gender: call?.gender || '',
        phone_mobile: call?.toNumber || '',
        email: call?.email || '',
        relevant,
        meeting: call?.meeting,
        next_attempt: nextAttempt,
        taskType: call?.taskType || '',
        nextCallDate: call?.nextCallDate || null,
        leadStatus: call?.leadStatus,
        dynvars
    };
}

function createDynvars(
    recording: string,
    transcript: string,
    callSummary: string,
    purchaseReadinessId: string,
    leadStatusId: string,
    dataInfromation: string,
) {
    const data = [
        // {
        //     title_id: 24519,
        //     type: "TextBox",
        //     title: "Call Recording",
        //     module_id: 3,
        //     value: recording
        // },
        {
            title_id: 24518,
            type: "TextBox",
            title: "Call Transcript",
            module_id: 3,
            value: transcript
        },
        {
            title_id: 24516,
            type: "TextBox",
            title: "Call Summary",
            module_id: 3,
            value: callSummary
        },
        {
            title_id: 24517,
            type: "Combo",
            title: "Purchase Readiness",
            module_id: 3,
            value: purchaseReadinessId
        },
        {
            title_id: 24559,
            type: "Combo",
            title: "Lead Status",
            module_id: 3,
            value: leadStatusId
        },
        {
            title_id: 24609,
            type: "TextBox",
            title: "Data Information",
            module_id: 3,
            value: dataInfromation

        }
    ];

    // Keep only items where value is not null, undefined, or empty string
    return data.filter(item => item.value !== null && item.value !== undefined && item.value !== "");
}

function determineRelevance(call: any): number {
    if (call.maxAttempt === call.attemptLength &&
        IRRELEVANT_STATUSES.has(call?.disconnectionReason)) {
        return 0; // Not Relevant
    }
    return 1; // Default to Relevant
}

async function checkClientExists(credentials: BmbyCredentials, clientId: number): Promise<boolean> {
    const soapEnvelope = createCheckClientSoapEnvelope(credentials, clientId);

    try {
        console.log(`Checking if client ${clientId} exists in BMBY...`);

        const response = await fetch(BMBY_SOAP_URL, {
            method: 'POST',
            headers: {
                ...SOAP_HEADERS,
                'SOAPAction': 'https://www.bmby.com/WebServices/srv/v3/GetAllJson'
            },
            body: soapEnvelope
        });

        if (!response.ok) {
            console.error(`HTTP error ${response.status} for client ${clientId}`);
            return false;
        }

        const result = await response.text();
        return parseClientExistenceResponse(result, clientId);

    } catch (error: any) {
        console.error(`Error checking client existence for ${clientId}:`, error.message);
        return false;
    }
}

function createCheckClientSoapEnvelope(credentials: BmbyCredentials, clientId: number): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                  xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                  xmlns:v3="https://www.bmby.com/WebServices/srv/v3/">
    <soapenv:Header/>
    <soapenv:Body>
        <v3:GetAllJson soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
            <Parameters xsi:type="v3:GetAllJson">
                <Login xsi:type="xsd:string">${credentials.username}</Login>
                <Password xsi:type="xsd:string">${credentials.password}</Password>
                <ProjectID xsi:type="xsd:int">${credentials.projectId}</ProjectID>
                <ClientID xsi:type="xsd:int">${clientId}</ClientID>
            </Parameters>
        </v3:GetAllJson>
    </soapenv:Body>
</soapenv:Envelope>`;
}

function parseClientExistenceResponse(result: string, clientId: number): boolean {
    const jsonMatch = result.match(/<GetAllJsonReturn[^>]*>(.*?)<\/GetAllJsonReturn>/);
    if (!jsonMatch) {
        console.error('Could not parse SOAP response');
        return false;
    }

    try {
        const jsonData = JSON.parse(jsonMatch[1]);
        if (jsonData.FoundRows > 0 && !jsonData.Error) {
            console.log(`Client ${clientId} exists in BMBY`);
            return true;
        } else if (jsonData.Error === "ClientID in another Project") {
            console.log(`Client ${clientId} exists but in different project - skipping`);
            return false;
        } else {
            console.log(`Client ${clientId} not found in BMBY - skipping`);
            return false;
        }
    } catch (parseError) {
        console.error(`Error parsing JSON response for client ${clientId}:`, parseError);
        return false;
    }
}

async function processBmbyUpdates(updates: BmbyUpdateData[], userData: any) {
    console.log(`Processing ${updates.length} BMBY updates...`);

    const credentials = getBmbyCredentials(userData);
    if (!credentials) {
        throw new Error('BMBY credentials not found in environment variables');
    }

    let processedCount = 0;
    let skippedCount = 0;
    // Process updates with better error handling and batch operations where possible
    for (const update of updates) {
        try {
            console.log(`Processing BMBY ID ${update.bmby_id}...`);

            const clientExists = await checkClientExists(credentials, update.bmby_id);

            if (!clientExists) {
                console.log(`Skipping BMBY ID ${update.bmby_id} - client does not exist or is in different project`);
                skippedCount++;

                // Update all calls with this bmbyId to mark as unavailable
                await calls.updateOne(
                    { bmbyId: update.bmby_id },
                    { $set: { availableInBmby: false } }
                );

                continue;
            }

            await updateLead(credentials, update.bmby_id, update);
            console.log(`Successfully updated BMBY ID: ${update.bmby_id}`);
            // Mark all calls with this bmbyId as synced
            await calls.updateMany(
                { bmbyId: update.bmby_id },
                { $set: { syncInBmby: true } }
            );

            if (LEAD_STATUS_FOR_TASK_CREATION.includes(update?.leadStatus)) {
                await createTask(credentials, update.bmby_id, update);
            }

            processedCount++;

        } catch (error: any) {
            console.error(`Error processing BMBY ID ${update.bmby_id}:`, error.message);
            // Continue processing other updates even if one fails
        }
    }

    console.log(`Completed processing BMBY updates: ${processedCount} processed, ${skippedCount} skipped`);
}

function getBmbyCredentials(userData: any): BmbyCredentials | null {
    const username = process.env.BMBY_USERNAME;
    const password = process.env.BMBY_PASSWORD;
    const projectId = userData?.bmbyProjectId || process.env.BMBY_PROJECT_ID;
    const userId = userData?.bmbyUserId || process.env.BMBY_USER_ID;

    if (!username || !password || !projectId || !userId) {
        return null;
    }

    return { username, password, projectId, userId };
}

async function updateLead(credentials: BmbyCredentials, clientId: number, update: BmbyUpdateData) {
    const formattedClientData = formatClientDataForBMBY(update, credentials, clientId);
    console.log(`Formatted client data for BMBY ID ${clientId}:`, JSON.stringify(formattedClientData, null, 2));
    const soapEnvelope = createUpdateLeadSoapEnvelope(credentials, formattedClientData);

    try {
        const response = await fetch(BMBY_SOAP_URL, {
            method: 'POST',
            headers: {
                ...SOAP_HEADERS,
                'SOAPAction': 'http://www.bmby.com/WebServices/srv/v3/Insert'
            },
            body: soapEnvelope
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const result = await response.text();
        console.log('SOAP Insert Lead Response:', result);
        return result;

    } catch (error: any) {
        console.error('SOAP Insert Lead Error:', error.message);
        throw error;
    }
}

function createUpdateLeadSoapEnvelope(credentials: BmbyCredentials, formattedClientData: any): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                  xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
                  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
                  xmlns:v3="http://www.bmby.com/WebServices/srv/v3/">
    <soapenv:Header/>
    <soapenv:Body>
        <v3:Insert soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
            <Parameters xsi:type="v3:GetAllInput">
                <Login xsi:type="xsd:string">${credentials.username}</Login>
                <Password xsi:type="xsd:string">${credentials.password}</Password>
                <ProjectID xsi:type="xsd:int">${credentials.projectId}</ProjectID>
                <UniqID xsi:type="xsd:int"></UniqID>
                <TaskID xsi:type="xsd:int"></TaskID>
                <ClientID xsi:type="xsd:int"></ClientID>
                <OwnerID xsi:type="xsd:int"></OwnerID>
                <ContractID xsi:type="xsd:int"></ContractID>
                <Dynamic xsi:type="xsd:int"></Dynamic>
                <Limit xsi:type="xsd:int"></Limit>
                <Offset xsi:type="xsd:int"></Offset>
                <OrderDesc xsi:type="xsd:int"></OrderDesc>
                <FromDate xsi:type="xsd:string"></FromDate>
                <ToDate xsi:type="xsd:string"></ToDate>
                <Type xsi:type="soapenc:Array" xmlns:soapenc="http://schemas.xmlsoap.org/soap/encoding/"></Type>
                <TypeString xsi:type="xsd:string"></TypeString>
                <SetPrivate xsi:type="xsd:int"></SetPrivate>
            </Parameters>
            <jsonClient xsi:type="xsd:string">${JSON.stringify(formattedClientData)}</jsonClient>
        </v3:Insert>
    </soapenv:Body>
</soapenv:Envelope>`;
}

function formatClientDataForBMBY(clientData: any, credentials: any, clientId: number | null = null) {
    const formattedData: any = {
        project_id: { value: parseInt(credentials?.projectId) },
        user_id: { value: credentials?.userId },
        client_id: { value: clientId },
        lead: { value: 1 },
        update: { value: 1 }
    };

    // Add basic client information efficiently
    const basicFieldMappings = {
        fname: 'fname',
        lname: 'lname',
        phone_mobile: 'phone_mobile',
        email: 'email',
        budget: 'budget',
        country: 'country',
        city: 'city',
        neighborhood: 'neighborhood'
    };

    Object.entries(basicFieldMappings).forEach(([key, field]) => {
        const value = clientData[field];
        if (value !== undefined && value !== null && value !== '') {
            formattedData[key] = { value };
        }
    });

    // Add numeric fields efficiently  
    const numericFieldMappings = {
        min_rooms: 'min_rooms',
        max_rooms: 'max_rooms',
        min_floor: 'min_floor',
        max_floor: 'max_floor',
        relevant: 'relevant',
        action_type: 'action_type'
    };

    Object.entries(numericFieldMappings).forEach(([key, field]) => {
        const value = clientData[field];
        if (value !== undefined && value !== null && value !== '') {
            formattedData[key] = { value: parseInt(String(value)) };
        }
    });

    // Add option fields
    if (clientData.appartment_type) {
        formattedData.appartment_type = { value: clientData.appartment_type };
    }

    // Add dynamic variables if provided
    if (clientData.dynvars?.length) {
        formattedData.dynvars = { value: clientData.dynvars };
        console.log('Adding dynvars to BMBY data:', JSON.stringify(clientData.dynvars, null, 2));
    }

    return formattedData;
}

function parseRoomRange(input: string): RoomRange {
    const str = input.toLowerCase().trim();
    const matches = str.match(/\d+/g);

    if (!matches?.length) {
        return { min_room: null, max_room: null };
    }

    const numbers = matches.map(n => parseInt(n, 10));

    if (numbers.length === 1) {
        return { min_room: numbers[0], max_room: numbers[0] };
    }
    return {
        min_room: Math.min(...numbers),
        max_room: Math.max(...numbers)
    };
}


function parseFloorRange(input: string): FloorRange {
    const str = input.toLowerCase().trim();
    const matches = str.match(/\d+/g);
    console.log("matches for floor", matches);

    if (!matches?.length) {
        return { min_floor: null, max_floor: null };
    }

    const numbers = matches.map(n => parseInt(n, 10)); // ✅ FIX HERE

    if (numbers.length === 1) {
        return { min_floor: numbers[0], max_floor: numbers[0] };
    }

    return {
        min_floor: Math.min(...numbers),
        max_floor: Math.max(...numbers),
    };
}

// Helper functions for consistent response formatting
function createSuccessResponse(totalCallsAnalyzed: number, bmbyUpdatesCount: number, updates: BmbyUpdateData[]) {
    return {
        success: true,
        totalCallsAnalyzed,
        bmbyUpdatesCount,
        updates,
        timestamp: new Date().toISOString()
    };
}

function createErrorResponse(errorMessage: string) {
    return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
    };
}

// Enhanced Purchase Readiness Utility Functions

/**
 * Get Purchase Readiness ID from text with enhanced dynamic parsing
 * Supports both static mappings and dynamic time period parsing
 */
function getPurchaseReadinessId(text: string): string {
    if (!text || text.trim() === '') return '';

    // Use the enhanced mapper that supports dynamic parsing
    return purchaseReadinessMapper.getId(text);
}


/**
 * Get Lead Status Id form lead status
 * Supports both static mappings and dynamic time period parsing
 */

function getLeadStatusId(text: string): string {
    if (!text || text.trim() === '') return '';

    const leadStatus = [
        { id: "74988", value: 'Already Bought' },

        { id: "74989", value: "Interested - Meeting" },
        { id: "74989", value: "Interested - Meeting Booked" },
        { id: "74989", value: "Interested Meeting" },

        { id: "74990", value: 'Interested Task' },
        { id: "74990", value: 'Interested - Task' },

        { id: "75078", value: "Human Review Needed" },
        { id: "75078", value: "Human Action Needed - Task" },

        { id: "74991", value: "Ask Human Call" },
        { id: "75019", value: "Not Interested" },
        { id: "75020", value: "Unclassified" },

        { id: "74991", value: "Human Call Needed" }
    ];

    const match = leadStatus.find(status =>
        status.value.toLowerCase() === text.trim().toLowerCase()
    );

    return match ? match.id : '';
}


/**
 * Get Property Type ID from text (supports English and German)
 */
function getPropertyTypeId(text: string): string {
    if (!text || text.trim() === '') return '';

    const normalizedText = text.toLowerCase().trim();
    return PROPERTY_TYPE_TEXT_TO_ID.get(normalizedText) || '';
}

function getActionTypeId(text: string): string {
    if (!text || text.trim() === '') return '';

    const normalized = text.toLowerCase();

    if (normalized.includes('rent')) {
        return '1'; // For rent property
    } else if (normalized.includes('buy')) {
        return '2'; // For buy property
    }

    return '';
}




async function createTask(credentials: BmbyCredentials, clientId: number, update: BmbyUpdateData) {

    const taskData = formatTaskDataForBMBY(update, clientId);
    console.log(`Creating task for BMBY ID ${clientId}:`, JSON.stringify(taskData, null, 2));

    const soapEnvelope = createTaskSoapEnvelope(credentials, taskData, clientId);
    try {
        const response = await fetch(BMBY_SOAP_URL + 'tasks.php', {
            method: 'POST',
            headers: {
                ...SOAP_HEADERS,
                'SOAPAction': 'http://www.bmby.com/WebServices/srv/v3/tasks.php#NewTask'
            },
            body: soapEnvelope
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const result = await response.text();
        console.log(`Task created successfully for BMBY ID ${clientId}:`, result);
        return result;

    } catch (error: any) {
        console.error(`Error creating task for BMBY ID ${clientId}:`, error.message);
        throw error;
    }
}

function createTaskSoapEnvelope(credentials: BmbyCredentials, taskData: any, clientId: any): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:tas="https://www.bmby.com/WebServices/srv/v3/tasks.php">
   <soapenv:Header/>
   <soapenv:Body>
      <tas:NewTask soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
         <Parameters xsi:type="tas:NewTaskInput">
            <Login>${credentials.username}</Login>
            <Password>${credentials.password}</Password>
            <ProjectID>${credentials.projectId}</ProjectID>
            <UserID xsi:type="xsd:int">${credentials.userId}</UserID>
            <MediaID xsi:type="xsd:string">994994</MediaID>
            <UniqID xsi:type="xsd:int">${clientId}</UniqID>
            <Type xsi:type="xsd:string">${taskData.type}</Type>
            <Designation xsi:type="xsd:string">${taskData.designation || "2"}</Designation>
            <Name xsi:type="xsd:string">${taskData.name || ""}</Name>
            <Phone xsi:type="xsd:string">${taskData.phone || ""}</Phone>
            <EMail xsi:type="xsd:string">${taskData.email || ""}</EMail>
            <Location xsi:type="xsd:string">${taskData.location || ""}</Location>
            <StartDate>${taskData.startDate}</StartDate>
            <EndDate>${taskData.endDate}</EndDate>
            <Subject xsi:type="xsd:string">${taskData.subject}</Subject>
            <Message>${taskData.message}</Message>
            <Priority xsi:type="xsd:string">${taskData.priority}</Priority>
         </Parameters>
      </tas:NewTask>
   </soapenv:Body>
</soapenv:Envelope>`;
}


function formatTaskDataForBMBY(clientData: BmbyUpdateData, clientId: number) {
    // Parse the nextAttempt date - try to parse natural language dates
    let startDate: Date;
    // Updated version of your original code
    if (clientData?.nextCallDate) {
        startDate = new Date(clientData?.nextCallDate);
    } else if (clientData?.next_attempt) {
        const parsedDate = parseNextAttemptDate(clientData.next_attempt);
        if (parsedDate) {
            startDate = parsedDate;
            console.log('startDate', startDate);
        } else {
            // If parsing fails, fallback to tomorrow
            startDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        }
    } else {
        // Final fallback to tomorrow
        startDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    // Parse duration from meeting data or default to 1 hour
    let durationMinutes = 60; // default 1 hour


    // Calculate end date based on duration
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

    // Format dates as YYYY-MM-DD HH:mm
    const formatDateTime = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    };

    const fullName = `${clientData.fname} ${clientData.lname}`.trim() || 'Unknown Contact';
    const location = clientData.city || clientData.neighborhood || clientData.country || 'Not specified';

    // Use meeting title if available, otherwise create default
    const subject = `Follow-up Appointment With ${fullName}`;

    // Create comprehensive message using available data
    let message = `Follow-up call scheduled for property inquiry.`;
    if (clientData.budget) message += ` Budget: ${clientData.budget}.`;
    if (clientData.min_rooms || clientData.max_rooms) {
        message += ` Rooms: ${clientData.min_rooms || 'Any'}-${clientData.max_rooms || 'Any'}.`;
    }
    return {
        clientId: clientId,
        type: clientData?.taskType ? clientData?.taskType : 'Task',
        subject: subject,
        startDate: formatDateTime(startDate),
        endDate: formatDateTime(endDate),
        message: message,
        designation: '2',// to customer
        name: fullName,
        phone: clientData.phone_mobile || '',
        email: clientData.email || '',
        location: location,
        priority: 'medium'
    };
}

function parseNextAttemptDate(nextAttemptString: any) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (!nextAttemptString) return null;
    const attemptLower = nextAttemptString.toLowerCase().trim();

    // --- helpers ---
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    function getNextDay(dayName: string) {
        const dayIndex = dayNames.indexOf(dayName);
        if (dayIndex === -1) return null;
        const targetDate = new Date(today);
        let daysAhead = dayIndex - today.getDay();
        if (daysAhead <= 0) daysAhead += 7;
        targetDate.setDate(today.getDate() + daysAhead);
        return targetDate;
    }

    function getDayOfWeek(weekOffset: number, dayName: string) {
        const dayIndex = dayNames.indexOf(dayName);
        if (dayIndex === -1) return null;

        // find Sunday of this week
        const sundayThisWeek = new Date(today);
        sundayThisWeek.setDate(today.getDate() - sundayThisWeek.getDay());

        // move to target week
        sundayThisWeek.setDate(sundayThisWeek.getDate() + (weekOffset * 7));

        // set to desired day
        sundayThisWeek.setDate(sundayThisWeek.getDate() + dayIndex);

        return sundayThisWeek;
    }

    // --- parsing rules ---
    // 1. immediate
    if (/\b(today|now|later today|this afternoon|this evening)\b/.test(attemptLower)) {
        return today;
    }

    // 2a. day after tomorrow
    if (/\b(day after tomorrow|day after tomm?|dat)\b/.test(attemptLower)) {
        const afterTomorrow = new Date(today);
        afterTomorrow.setDate(today.getDate() + 2);
        return afterTomorrow;
    }

    // 2b. tomorrow
    if (/\b(tomorrow|tom)\b/.test(attemptLower)) {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return tomorrow;
    }

    // 3. in X units
    const inMatch = attemptLower.match(/in (\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten) (day|days|week|weeks|month|months)/);
    if (inMatch) {
        const numberMap: Record<string, number> = {
            a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
            six: 6, seven: 7, eight: 8, nine: 9, ten: 10
        };
        const amount = isNaN(Number(inMatch[1])) ? numberMap[inMatch[1]] : parseInt(inMatch[1]);
        const unit = inMatch[2];
        const targetDate = new Date(today);
        if (unit.startsWith('day')) targetDate.setDate(today.getDate() + amount);
        else if (unit.startsWith('week')) targetDate.setDate(today.getDate() + (amount * 7));
        else if (unit.startsWith('month')) targetDate.setMonth(today.getMonth() + amount);
        return targetDate;
    }

    // 4. next week
    if (attemptLower.includes('next week')) {
        const dayMatch = attemptLower.match(/next week\s+(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
        if (dayMatch) return getDayOfWeek(1, dayMatch[1]);
        return getDayOfWeek(1, 'monday');
    }

    // "next sunday" or "next monday"
    const nextDayMatch = attemptLower.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    if (nextDayMatch) {
        return getDayOfWeek(1, nextDayMatch[1]);
    }

    // 5. next month (kept same as your version)
    if (attemptLower.includes('next month')) {
        const nextMonth = new Date(today);
        nextMonth.setMonth(today.getMonth() + 1);
        nextMonth.setDate(1);
        return nextMonth;
    }

    // 6. this week
    if (attemptLower.includes('this week')) {
        const dayMatch = attemptLower.match(/this week\s+(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
        if (dayMatch) return getDayOfWeek(0, dayMatch[1]);
    }

    // 7. end of week/month
    if (/end of (this )?week/.test(attemptLower)) return getDayOfWeek(0, 'saturday');
    if (/end of (this )?month/.test(attemptLower)) return new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // 8. beginning of next week/month
    if (/beginning of next week|start of next week/.test(attemptLower)) return getDayOfWeek(1, 'monday');
    if (/beginning of next month|start of next month/.test(attemptLower)) {
        const nextMonth = new Date(today);
        nextMonth.setMonth(today.getMonth() + 1);
        nextMonth.setDate(1);
        return nextMonth;
    }

    // 9. generic day names
    for (const day of dayNames) {
        if (attemptLower.includes(day)) return getNextDay(day);
    }

    // 10. after weekend
    if (/after (the )?weekend/.test(attemptLower)) return getDayOfWeek(1, 'monday');

    // 11. unavailable → next business day
    if (/busy|meeting|conference|vacation|holiday|unavailable/.test(attemptLower)) {
        const nextBusinessDay = new Date(today);
        nextBusinessDay.setDate(today.getDate() + 1);
        if (nextBusinessDay.getDay() === 6) nextBusinessDay.setDate(nextBusinessDay.getDate() + 2);
        if (nextBusinessDay.getDay() === 0) nextBusinessDay.setDate(nextBusinessDay.getDate() + 1);
        return nextBusinessDay;
    }

    // 12. vague → tomorrow
    if (/later|sometime|eventually|soon|another time/.test(attemptLower)) {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return tomorrow;
    }

    return null;
}


export const decryptPassword = (encryptedText: string): string => {
    const algorithm = 'aes-256-cbc';

    const secretKey = process.env.ENCRYPTION_KEY;
    if (!secretKey) throw new Error("ENCRYPTION_KEY not set");

    const [ivHex, encryptedData] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    if (iv.length !== 16) {
        throw new Error(`Invalid IV length: ${iv.length}, expected 16`);
    }

    const key = crypto.createHash('sha256').update(secretKey).digest();

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};


