import { FastifyReply, FastifyRequest } from 'fastify';
import { Server } from '../../../server';
import { WebhookService } from '../services/webhook.service';
import { extractCompanyIdFromSignature, getUserConfiguration, validatePhone, validateUserConfiguration } from '../helper/webhook.helper';
import { Company } from '../../company/models/company.model';
import { bmbyService } from '../bmby.service';
import { BlackList } from '../../black-list/models/black-list.model';
import { GoogleSheetDataProcess } from '../../google-sheet/models/google-sheet.model';
const webhookService = new WebhookService();


// Allowed genders
const VALID_GENDERS = new Set(['male', 'female', 'other']);




// Email validation
function isValidEmail(email: string | number | null | undefined): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@\.]+$/.test(String(email).trim());
}

export async function webhookHandler(request: FastifyRequest, reply: FastifyReply) {
  Server.log.info({ headers: request.headers, body: request.body }, 'Webhook received');

  let rawSignature = (request.query as any)?.signature;

  if (!rawSignature) {
    Server.log.warn('Missing signature in webhook request');
    return reply.code(401).send({ error: 'Signature is required' });
  }

  let companyId: string | null = null;

  try {
    companyId = await extractCompanyIdFromSignature(rawSignature);

    if (!companyId) {
      Server.log.warn('Could not extract company ID from signature');
      return reply.code(401).send({ error: 'Invalid signature format' });
    }

    Server.log.info({ companyId }, 'Company ID extracted from signature');
  } catch (error) {
    Server.log.error({ error, rawSignature }, 'Error extracting company ID');
    return reply.code(401).send({ error: 'Invalid signature' });
  }

  try {
    const company = await Company.findById(companyId);

    if (!company || company.isArchived === true) {
      const errorMessage = !company ? 'Company not found' : 'Company is archived';
      const statusCode = !company ? 404 : 403;

      Server.log.warn({ companyId }, errorMessage);
      return reply.code(statusCode).send({ error: errorMessage });
    }

    Server.log.info({ companyId }, 'Company validation passed');
  } catch (error) {
    Server.log.error({ error, companyId }, 'Database error while checking company');
    return reply.code(500).send({ error: 'Internal server error' });
  }

  try {
    const callLog = await webhookService.saveCallLog(request.body, request.headers);
    Server.log.info('Call log saved successfully');

    const result = await webhookService.handleWebhook(request.body, callLog._id);
    Server.log.info(result, 'Webhook processed');
    reply.code(200).send({ status: 'success', message: 'Webhook processed' });
  } catch (err) {
    Server.log.error(err, 'Webhook processing error');
    reply.code(200).send({ status: 'error', message: 'Error occurred but webhook acknowledged' });
  }
}

const FIELD_NAMES: Record<string, string> = {
  fullName: 'Full Name',
  email: 'Email',
  region: 'Region',
  phoneNumber: 'Phone Number',
  gender: 'Gender',
  'additionalInformation.clientId': 'Client ID',
  'additionalInformation.email': 'Email'
};

export async function readSheetHandler(request: FastifyRequest, reply: FastifyReply) {

  try {
    const authenticatedUser: any = request.user;
    const body = request.body as any;

    console.log('📥 Received sheets webhook:', body);

    if (!authenticatedUser || !authenticatedUser.userId || !authenticatedUser.companyId) {
      return reply.code(401).send({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!body?.metadata?.agentId) {
      return reply.code(400).send({
        success: false,
        error: 'agentId is required'
      });
    }

    const userConfig = await getUserConfiguration(authenticatedUser.userId, authenticatedUser.companyId, body?.metadata?.agentId);

    if (!userConfig) {
      console.error('❌ User configuration not found');
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch user configuration'
      });
    }

    const configErrors = validateUserConfiguration(userConfig);
    if (configErrors.length > 0) {
      return reply.code(403).send({
        success: false,
        error: 'User configuration incomplete',
        details: configErrors
      });
    }

    // Prepare BMBY credentials from user config
    const bmbyCredentials = {
      projectId: userConfig.bmbyProjectId!,
      userId: userConfig.bmbyUserId!
    };

    // Validate BMBY credentials (username/password from env + projectId/userId from user)
    const fullCredentials = {
      username: process.env.BMBY_USERNAME || "",
      password: process.env.BMBY_PASSWORD || "",
      projectId: bmbyCredentials.projectId,
      userId: bmbyCredentials.userId
    };

    if (!bmbyService.validateCredentials(fullCredentials)) {
      return reply.code(500).send({
        success: false,
        error: 'BMBY service not configured properly (missing credentials)'
      });
    }



    const records = body.records || [body];

    if (!records.length) {
      return reply.code(400).send({ success: false, message: 'No records found' });
    }

    const requiredFields = new Set(
      (userConfig.additionalInfoConfig || [])
        .filter((f: any) => f.required)
        .map((f: any) => f.fieldName)
    );

    const savedRecords: any[] = [];
    const validationErrors: any[] = [];
    let skippedRecords = 0;
    let newClientsCreated = 0;
    const queueProcessInMinutes = userConfig.queueProcessInMinutes || 3;
    const maxAttempts = userConfig.maxAttempts || 3;

    for (const raw of records) {

      console.log("raw checking here", raw)
      if (!raw.additionalInformation) raw.additionalInformation = {};

      const errors: string[] = [];

      // Validate main required fields
      const mainRequiredFields = ['fullName', 'email', 'phoneNumber'];
      for (const field of mainRequiredFields) {
        if (!raw[field] || String(raw[field]).trim() === '') {
          errors.push(`${FIELD_NAMES[field]} is missing`);
        }
      }

      if (!errors.length && raw.email && !isValidEmail(raw.email)) {
        errors.push('Email is invalid');
      }

      if (!errors.length && raw.phoneNumber) {
        let phone = String(raw.phoneNumber)?.trim()?.replace(/\s+/g, '');
        if (!phone.startsWith('+')) phone = '+' + phone;
        const validPhone = validatePhone(phone);
        if (!validPhone) {
          errors.push('Phone number is invalid (must include country code like +49xxxxxx)');
        } else {
          raw.phoneNumber = String(phone);
        }
      }

      const isBlackList = await BlackList.findOne({ toNumber: raw.phoneNumber, companyId: userConfig.company._id, isArchived: false });
      if (isBlackList) {
        errors.push('Phone number is blacklisted');
      }

      const isAlreadyCalled = await GoogleSheetDataProcess.findOne({ "sheetData.phoneNumber": raw.phoneNumber, companyId: userConfig.company._id });
      if (isAlreadyCalled) {
        errors.push('On this number already called by this company');
      }


      // Normalize additionalInformation keys
      const normalizedAdditionalInfo: Record<string, any> = {};
      for (const [key, value] of Object.entries(raw.additionalInformation)) {
        const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
        normalizedAdditionalInfo[camelKey] = value;
      }
      raw.additionalInformation = normalizedAdditionalInfo;

      // Validate required additionalInfo fields (skip clientId)
      if (!errors.length) {
        for (const field of requiredFields) {
          if (field === 'clientId') continue; // clientId handled separately
          if (!normalizedAdditionalInfo[field]) {
            const key = `additionalInformation.${field}`;
            errors.push(`${FIELD_NAMES[key] || field} is missing`);
          }
        }
      }

      if (!errors.length && raw.gender && !VALID_GENDERS.has(raw.gender.toLowerCase())) {
        errors.push('Gender must be Male, Female, or Other');
      }

      if (errors.length > 0) {
        validationErrors.push({
          rowNumber: raw.rowNumber,
          errors: errors.join(', '),
          data: raw
        });
        continue;
      }

      let clientId = raw.additionalInformation.clientId || raw.additionalInformation.bmbyId || null;

      if (clientId) {
        clientId = Number(clientId);
        skippedRecords++;
        console.log(`Using existing clientId ${clientId} from sheet for row ${raw.rowNumber}`);
      }


      if (!clientId) {
        console.log(`No clientId in sheet for row ${raw.rowNumber} - Checking  existing clientId by email`);
        try {
          // Use createOrUpdateUser instead of createUser
          const bmbyResult = await bmbyService.createOrUpdateUser(
            {
              fullName: raw.fullName,
              email: raw.email,
              phoneNumber: raw.phoneNumber,
              region: raw.region,
              gender: raw.gender,
              ...raw.additionalInformation
            },
            bmbyCredentials
          );

          if (!bmbyResult.success) {
            validationErrors.push({
              rowNumber: raw.rowNumber,
              errors: bmbyResult.error || 'Failed to create/update user in BMBY',
              data: raw
            });
            continue;
          }

          clientId = Number(bmbyResult.bmbyId);
          raw.additionalInformation.clientId = clientId;

          // Track if it was a new client or existing
          if (bmbyResult.isExisting) {
            skippedRecords++; // Or create a new counter for "updated"
            console.log(`♻️ Found and updated existing clientId ${clientId} in BMBY for email: ${raw.email}`);
          } else {
            newClientsCreated++;
            console.log(`✨ Created new clientId ${clientId} in BMBY for email: ${raw.email}`);
          }

        } catch (err: any) {
          validationErrors.push({
            rowNumber: raw.rowNumber,
            errors: `BMBY creation/update failed: ${err.message}`,
            data: raw
          });
          continue;
        }
      }

      console.log(`📋 Final clientId for row ${raw.rowNumber}:`, clientId);

      // Save record in DB
      const sheetRecord = {
        assistantId: userConfig.assistantId,
        phoneNumberId: userConfig.phoneNumberId,
        companyId: userConfig.company._id,
        agentId: userConfig.agentId,
        timeZone: body?.metadata?.timeZone,
        createdBy: authenticatedUser.userId,
        createdAt: new Date(),
        outboundNumber: userConfig.outboundNumber || null,
        sheetData: raw,
        reason: '',
        queueProcessInMinutes,
        maxAttempts
      };

      try {
        const doc = await webhookService.saveGoogleSheetRecord(sheetRecord);
        savedRecords.push({
          rowNumber: raw.rowNumber,
          record: {
            _id: doc._id,
            reason: '',
            uniqueRowId: doc.sheetData?.uniqueRowId,
            clientId
          }
        });
      } catch (err: any) {
        validationErrors.push({
          rowNumber: raw.rowNumber,
          errors: `Database error: ${err.message}`,
          data: raw
        });
      }
    }

    return reply.code(200).send({
      success: true,
      user: {
        userId: authenticatedUser.userId,
        email: authenticatedUser.email,
        companyId: authenticatedUser.companyId
      },
      savedRecords,
      validationErrors,
      summary: {
        total: records.length,
        saved: savedRecords.length,
        skipped: skippedRecords,
        newClientsCreated,
        validationFailed: validationErrors.length,
        successRate: `${((savedRecords.length / records.length) * 100).toFixed(1)}%`
      }
    });
  } catch (err: any) {
    console.error('Internal server error:', err);
    return reply.code(500).send({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
}