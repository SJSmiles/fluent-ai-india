import { batchCallService } from '../services/batchCall.service';
import { Server } from '../../../server';
import { throwError, uploadDir } from '../../../common/app-helper';
import parseFile, { validatePhone } from '../helpers/helper';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { pipeline as _pipeline } from 'stream';
import { BATCH_CALL_FOLLOWUPS_DIFF, BATCH_CALL_START_AFTER, BATCH_CALL_STATUS, CALL_DELETE_BEFORE } from '../../../config/server-config';
import moment from 'moment';
import { BatchCall } from '../models/batchCall.model';
import { Types } from 'mongoose';
import { BatchCallFollowUps } from '../models/batchCallFollowUps.model';

import { Call } from '../../webhook/models/call.model';
import { Agent } from '../../agent/model/agent.model';
import { Company } from '../../company/models/company.model';
import { UserAgent } from '../../agent/model/user-agent.model';
const pipeline = promisify(_pipeline);

// Validation schemas and types
interface Contact {
  number: string;
  gender: 'masculine' | 'feminine' | 'neuter' | '' | null;
  firstName: string;
  lastName: string;
  email: string;
  bmbyid: number;
  country?: string;
  salutation?: string;
}

interface BatchCallPayload {
  name: string;
  agentId?: string;
  leadGroupId?: string;
  schedule: boolean;
  timezone?: string;
  date: string;
  time: string;
  status?: number;
  utcDateTime?: string;
  followUpsDetails?: any[];
}

// Validation utilities
const VALID_GENDERS = new Set(['masculine', 'feminine', 'neuter', 'male', 'female', '', null]);
const REQUIRED_CSV_COLUMNS = ['salutation', 'phone_number', 'gender', 'first_name', 'last_name', 'email', 'client_id', 'country'] as const;
const BATCH_SIZE = 1000; // Process records in batches

class ValidationError extends Error {
  constructor(
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Optimized phone validation with caching
const phoneValidationCache = new Map<string, string | null>();
const MAX_CACHE_SIZE = 50000; // Limit cache size to prevent memory issues

function isValidPhone(number: string): string | null {
  const trimmedNumber = number.trim();

  // Check cache first
  if (phoneValidationCache.has(trimmedNumber)) {
    return phoneValidationCache.get(trimmedNumber)!;
  }

  const phoneRegex = /^\+?[\d\s\-\(\)]{7,15}$/;

  // Validate the number format
  if (!phoneRegex.test(trimmedNumber)) {
    // Cache negative results too
    if (phoneValidationCache.size < MAX_CACHE_SIZE) {
      phoneValidationCache.set(trimmedNumber, null);
    }
    return null;
  }

  // If valid and doesn't start with +, add it
  const result = !trimmedNumber.startsWith('+') ? '+' + trimmedNumber : trimmedNumber;

  // Cache the result
  if (phoneValidationCache.size < MAX_CACHE_SIZE) {
    phoneValidationCache.set(trimmedNumber, result);
  }

  return result;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@\.]+$/;
  return emailRegex.test(email.trim());
}

// Optimized batch validation function
function validateContactsBatch(
  contacts: any[],
  startIndex: number
): { valid: Contact[]; errors: string[] } {
  const validatedContacts: Contact[] = [];
  const errors: string[] = [];
  const numberSet = new Set<string>(); // For duplicate detection within batch
  const bmbyIdSet = new Set<number>(); // For BmbyId duplicate detection within batch
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const rowIndex = startIndex + i + 2; // +2 for header row and 1-based indexing
    try {
      // Fast validation checks
      const numberStr = contact.phone_number?.toString().trim();
      const salutationStr = contact.salutation?.toString().trim();
      const firstNameStr = contact.first_name?.toString().trim();
      const lastNameStr = contact.last_name?.toString().trim();
      const genderStr = contact.gender?.toString().trim().toLowerCase();
      const emailStr: any = contact.email?.toString().trim().toLowerCase();
      const bmbyIdStr = contact.client_id?.toString().trim();
      const countryStr = contact.country?.toString().trim();

      if (!numberStr) {
        errors.push(`Row ${rowIndex}: Phone number is required`);
        continue;
      }

      if (!firstNameStr) {
        errors.push(`Row ${rowIndex}: First name is required`);
        continue;
      }

      if (!bmbyIdStr) {
        errors.push(`Row ${rowIndex}: BmbyId is required`);
        continue;
      }
      if (genderStr) {
        if (!VALID_GENDERS.has(genderStr)) {
          errors.push(`Row ${rowIndex}: Gender must be one of: 'masculine', 'feminine', 'neuter' or empty`);
          continue;
        }
      }


      if (emailStr) {
        if (!isValidEmail(emailStr)) {
          errors.push(`Row ${rowIndex}: Email is in valid format`);
          continue;
        }
      }

      const contactNumber = isValidPhone(numberStr);
      if (!contactNumber) {
        errors.push(`Row ${rowIndex}: Invalid phone number format`);
        continue;
      }

      // Validate BmbyId - must be a number
      const bmbyIdNum = parseInt(bmbyIdStr);
      if (isNaN(bmbyIdNum) || !Number.isInteger(bmbyIdNum)) {
        errors.push(`Row ${rowIndex}: BmbyId must be a valid number`);
        continue;
      }

      // Check for duplicate phone numbers within this batch
      if (numberSet.has(contactNumber)) {
        errors.push(`Row ${rowIndex}: Duplicate Phone Number '${contactNumber}' found`);
        continue;
      }

      // Check for duplicate BmbyId within this batch
      if (bmbyIdSet.has(bmbyIdNum)) {
        errors.push(`Row ${rowIndex}: Duplicate BmbyId '${bmbyIdNum}' found`);
        continue;
      }
      try {
        if (!validatePhone(contactNumber)) {
          errors.push(
            `Row ${rowIndex}: Invalid phone number format for ${contactNumber}, Please add with country code like(+49xxxxxxxxxx)`
          );
          continue;
        }
      } catch (error) {
        errors.push(`Row ${rowIndex}: Invalid phone number format`);
        continue;
      }

      numberSet.add(contactNumber);
      bmbyIdSet.add(bmbyIdNum);
      validatedContacts.push({
        number: contactNumber,
        salutation: salutationStr,
        gender: genderStr ? genderStr.toLowerCase() : '',
        firstName: firstNameStr,
        lastName: lastNameStr,
        email: emailStr,
        bmbyid: bmbyIdNum,
        country: countryStr,
      });
    } catch (error: any) {
      errors.push(`Row ${rowIndex}: ${error.message || 'Validation error'}`);
    }
  }

  return { valid: validatedContacts, errors };
}

// Validate batch call payload (unchanged but optimized)
function validateBatchCallPayload(formData: any) {
  try {
    let errors: any = [];
    if (formData?.followUpsDetails) {
      const followUpsDetails = Array.isArray(formData?.followUpsDetails)
        ? formData.followUpsDetails
        : JSON.parse(formData?.followUpsDetails);
      formData.followUpsDetails = followUpsDetails;
    }

    if (!formData.name?.trim()) {
      errors.push('Batch call name is required');
    }

    if (formData.status) {
      formData.status = parseInt(formData.status);
      if (isNaN(formData.status) || !Number.isInteger(formData.status)) {
        errors.push('Status must be an integer');
      } else if (
        formData.status < BATCH_CALL_STATUS.DRAFT ||
        formData.status > BATCH_CALL_STATUS.CREATED
      ) {
        errors.push('Status must be 1 (DRAFT) or 9 (CREATED)');
      }
    } else {
      formData.status = BATCH_CALL_STATUS.DRAFT;
    }


    const schedule = formData.schedule === 'true' || formData.schedule === true;

    if (schedule) {
      if (!formData.date?.trim()) {
        errors.push('Date is required for scheduled calls');
      }
      if (!formData.time?.trim()) {
        errors.push('Time is required for scheduled calls');
      }

      if (formData.date && !/^\d{4}-\d{2}-\d{2}$/.test(formData.date.trim())) {
        errors.push('Date must be in YYYY-MM-DD format');
      }

      if (formData.time && !/^\d{2}:\d{2}$/.test(formData.time.trim())) {
        errors.push('Time must be in HH:MM format');
      }

      if (formData.date?.trim() && formData.time?.trim()) {
        try {
          const timezone = formData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
          const dateTimeString = `${formData.date.trim()}T${formData.time.trim()}`;
          const scheduledMoment = moment.tz(dateTimeString, timezone);

          if (!scheduledMoment.isValid()) {
            errors.push('Invalid date/time format');
          } else {
            const scheduledUTC = scheduledMoment.utc();
            const currentUTC = moment.utc();
            const minScheduleUTC = currentUTC.clone().add(10, 'minutes');

            if (scheduledUTC.isBefore(minScheduleUTC)) {
              errors.push('Scheduled time must be at least 10 minutes from now');
            }
          }
        } catch (error) {
          console.error('Moment validation error:', error);
          errors.push('Invalid date/time or timezone');
        }
      }
    }

    if (Array.isArray(formData?.followUpsDetails) && formData?.followUpsDetails.length > 0) {
      errors = checkFollowUpsDetails(formData, errors, false);
    }

    if (errors.length > 0) {
      throw new ValidationError(`Validation failed with`, errors);
    }
    return {
      name: formData.name.trim(),
      agentId: formData.agentId?.trim() || undefined,
      leadGroupId: formData.leadGroupId?.trim() || undefined,
      status: formData.status ? parseInt(formData.status) : 1,
      timezone: formData?.timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone,
      date: formData?.date?.trim() || new Date().toISOString().split('T')[0],
      schedule,
      time: formData?.time?.trim() || new Date().toTimeString().substring(0, 5),
      followUpsDetails: Array.isArray(formData?.followUpsDetails) && formData?.followUpsDetails.length > 0 ? formData?.followUpsDetails : [],
      phoneNumberId: formData.phoneNumberId?.trim() || undefined,
    };


  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Failed to parse file', error.message);
  }

}

async function parseAndValidateFile(filePath: string): Promise<Contact[]> {
  try {
    const contacts = await parseFile(filePath);
    if (!Array.isArray(contacts) || contacts.length === 0) {
      throw new ValidationError('File contains no valid contacts');
    }

    console.log(`Processing ${contacts.length} contacts...`);

    // Validate file structure
    const firstContact = contacts[0];
    const availableKeys = Object.keys(firstContact).map((key) =>
      key
        .replace(/^\uFEFF/, '')
        .trim()
        .toLowerCase()
    );
    const requiredKeys = REQUIRED_CSV_COLUMNS.map((col) => col.toLowerCase());
    const missingColumns = requiredKeys.filter((col) => !availableKeys.includes(col));

    if (missingColumns.length > 0) {
      throw new ValidationError(
        `Missing required columns: ${missingColumns.join(', ')}. Required columns are: ${REQUIRED_CSV_COLUMNS.join(', ')}. Available columns: ${availableKeys.join(', ')}`
      );
    }

    const normalizedContacts = contacts.map((contact) => {
      const normalizedContact: any = {};
      Object.keys(contact).forEach((key) => {
        const cleanKey = key
          .replace(/^\uFEFF/, '')
          .trim()
          .toLowerCase();
        normalizedContact[cleanKey] = contact[key];
      });
      return normalizedContact;
    });

    // Process in batches to avoid blocking the event loop
    const validatedContacts: Contact[] = [];
    const allErrors: string[] = [];
    const globalNumberSet = new Set<string>(); // For global duplicate detection
    const globalBmbyIdSet = new Set<number>(); // For global BmbyId duplicate detection

    for (let i = 0; i < normalizedContacts.length; i += BATCH_SIZE) {
      const batch = normalizedContacts.slice(i, i + BATCH_SIZE);
      const { valid, errors } = validateContactsBatch(batch, i);

      // Check for duplicates across all batches
      for (const contact of valid) {
        if (globalNumberSet.has(contact.number)) {
          allErrors.push(`Duplicate Phone Number '${contact.number}' found across file`);
        } else if (globalBmbyIdSet.has(contact.bmbyid)) {
          allErrors.push(`Duplicate client Id '${contact.bmbyid}' found across file`);
        } else {
          globalNumberSet.add(contact.number);
          globalBmbyIdSet.add(contact.bmbyid);
          validatedContacts.push(contact);
        }
      }

      allErrors.push(...errors);

      // Allow event loop to process other requests
      if (i + BATCH_SIZE < normalizedContacts.length) {
        await new Promise((resolve) => setImmediate(resolve));
      }

      // Log progress for large files
      if (normalizedContacts.length > 10000 && (i + BATCH_SIZE) % 10000 === 0) {
        console.log(`Processed ${i + BATCH_SIZE}/${normalizedContacts.length} contacts`);
      }
    }

    if (allErrors.length > 0) {
      // For large files, limit the number of errors reported
      const maxErrors = 100;
      const errorSummary =
        allErrors.length > maxErrors
          ? [
            ...allErrors.slice(0, maxErrors),
            `... and ${allErrors.length - maxErrors} more errors`,
          ]
          : allErrors;

      throw new ValidationError(`Validation failed with ${allErrors.length} errors`, errorSummary);
    }

    if (validatedContacts.length === 0) {
      throw new ValidationError('No valid contacts found in file');
    }

    console.log(`Successfully validated ${validatedContacts.length} contacts`);
    return validatedContacts;
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Failed to parse file', error.message);
  }
}

function checkFollowUpsDetails(payload: any, errors: any, fromStartCall: boolean) {
  const validatedMoments: any = [];
  // Validate timezone
  if (!payload.timezone?.trim()) {
    errors.push('Timezone is required');
  }

  // Validate followUpsDetails array
  if (!payload.followUpsDetails || !Array.isArray(payload.followUpsDetails) || payload.followUpsDetails.length === 0) {
    errors.push('At least one follow-up detail is required');
  } else {

    for (let i = 0; i < payload.followUpsDetails.length; i++) {
      const detail = payload.followUpsDetails[i];
      const rowIndex = i + 1;

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!detail.date?.trim()) {
        errors.push(`Row ${rowIndex}: Date is required`);
        continue;
      }
      if (!dateRegex.test(detail.date.trim())) {
        errors.push(`Row ${rowIndex}: Date must be in YYYY-MM-DD format`);
        continue;
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!detail.time?.trim()) {
        errors.push(`Row ${rowIndex}: Time is required`);
        continue;
      }
      if (!timeRegex.test(detail.time.trim())) {
        errors.push(`Row ${rowIndex}: Time must be in HH:MM format (24-hour)`);
        continue;
      }

      // Validate date/time combination with timezone
      try {
        const dateTimeString = `${detail.date.trim()}T${detail.time.trim()}`;
        const scheduledMoment = moment.tz(dateTimeString, payload.timezone);

        if (!scheduledMoment.isValid()) {
          errors.push(`Row ${rowIndex}: Invalid date/time combination`);
          continue;
        }

        // Check if the date/time is in the past
        if (scheduledMoment.isBefore(moment())) {
          errors.push(`Row ${rowIndex}: Follow-up date/time cannot be in the past`);
          continue;
        }

        validatedMoments.push(scheduledMoment);
      } catch (error) {
        console.error('Moment validation error:', error);
        errors.push(`Row ${rowIndex}: Invalid date/time or timezone`);
      }
    }

    // Validate 24-hour difference between follow-up calls
    if (validatedMoments.length > 1) {
      // Sort moments by date/time
      const sortedMoments = [...validatedMoments].sort((a, b) => a.valueOf() - b.valueOf());

      for (let i = 1; i < sortedMoments.length; i++) {
        const previousMoment = sortedMoments[i - 1];
        const currentMoment = sortedMoments[i];
        const difference = currentMoment.diff(previousMoment, BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN, true);

        if (difference < BATCH_CALL_FOLLOWUPS_DIFF.DIFF_VALUE) {
          const originalIndex1 = validatedMoments.findIndex((m: { valueOf: () => any; }) => m.valueOf() === previousMoment.valueOf()) + 1;
          const originalIndex2 = validatedMoments.findIndex((m: { valueOf: () => any; }) => m.valueOf() === currentMoment.valueOf()) + 1;
          errors.push(`Follow-up calls must have at least ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_VALUE} ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN} difference (Row ${originalIndex1} and Row ${originalIndex2} are ${difference.toFixed(1)} ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN} apart)`);
        }
      }
    }

    // Check for duplicate date/time combinations
    const dateTimeStrings = new Set();
    payload.followUpsDetails.forEach((detail: { date: string; time: string; }, index: number) => {
      if (detail.date?.trim() && detail.time?.trim()) {
        const dateTimeKey = `${detail.date.trim()}_${detail.time.trim()}`;
        if (dateTimeStrings.has(dateTimeKey)) {
          errors.push(`Row ${index + 1}: Duplicate date/time combination found`);
        }
        dateTimeStrings.add(dateTimeKey);
      }
    });
  }


  // Validate batch ID exists and get original batch call details
  let originalBatchMoment: any;
  const schedule = payload.schedule === 'true' || payload.schedule === true;
  if (schedule) {
    const dateTimeString = `${payload.date.trim()}T${payload.time.trim()}`;
    originalBatchMoment = moment.tz(dateTimeString, payload.timezone);
  } else {
    if (fromStartCall) {
      const dateTimeString = `${payload.date.trim()}T${payload.time.trim()}`;
      originalBatchMoment = moment.tz(dateTimeString, payload.timezone);
    } else {
      const now = moment().add(BATCH_CALL_START_AFTER.DIFF_VALUE, BATCH_CALL_START_AFTER.DIFF_IN);
      originalBatchMoment = now; // Remove .toDate() to keep it as a moment object
    }

  }
  // Validate difference between original batch call and first follow-up
  if (originalBatchMoment && validatedMoments.length > 0) {
    const sortedMoments = [...validatedMoments].sort((a, b) => a.valueOf() - b.valueOf());
    const firstFollowUpMoment = sortedMoments[0];
    const difference = firstFollowUpMoment.diff(originalBatchMoment, BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN, true);
    if (difference < BATCH_CALL_FOLLOWUPS_DIFF.DIFF_VALUE) {
      const originalIndex = validatedMoments.findIndex((m: { valueOf: () => any; }) => m.valueOf() === firstFollowUpMoment.valueOf()) + 1;
      errors.push(`First follow-up call must have at least  ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_VALUE} ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN} difference from original batch call (currently ${difference.toFixed(1)} ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN} apart - Row ${originalIndex})`);
    }
  }
  return errors;

}

export async function createBatchCallHandler(request: any, reply: any) {
  let filePath: string | null = null;

  try {
    const user = request.user
    if (!user || user.profileCompletion === false) {
      return reply.status(400).send({
        success: false,
        error: 'Profile Incomplete',
        message: 'Please complete your user profile before creating batch calls',
        details: []
      });
    }
    const parts = request.parts();
    let formData: Record<string, any> = {};

    // Process multipart form data
    for await (const part of parts) {
      if (part.file) {
        filePath = path.join(uploadDir(), part.filename);
        await pipeline(part.file, fs.createWriteStream(filePath));
      } else {
        const field = part.fieldname;
        const value = part.value;

        const bracketMatch = field.match(/^(\w+)\[(\w+)\]$/);
        if (bracketMatch) {
          const [, parent, child] = bracketMatch;
          if (!formData[parent]) {
            formData[parent] = {};
          }
          formData[parent][child] = value;
        } else {
          formData[field] = value;
        }
      }
    }
    if (!filePath) {
      throw new ValidationError('No file uploaded');
    }

    const validatedPayload = validateBatchCallPayload(formData);
    console.log('Validated Payload:', validatedPayload);

    const validatedContacts = await parseAndValidateFile(filePath);

    //convert bmbyid back to bmbyId for database
    const recipientsForDb = validatedContacts.map((contact) => ({
      ...contact,
      bmbyId: contact.bmbyid
    }));
    const company: any = await Company.findOne({
      _id: user.companyId
    }).lean()
    let agentId = null
    let vapiPhoneNumberId = null
    if (company && company?.voiceProvider === "vapi") {
      const db = Agent.db;
      const agentCollection = db.collection('Agent');
      // Find agent by agentId
      const agent = await agentCollection.findOne(
        { agentId: validatedPayload.agentId },
        { projection: { _id: 1, agentId: 1, vapiPhoneNumberId: 1 } }
      );

      if (!agent) {
        throwError('No agent found for this agentId');
        return;
      }

      // Find the userAgent that matches both userId and agent
      const userAgent: any = await UserAgent.findOne({
        userId: user.userId,
        isArchived: false,
        agentId: agent._id
      });
      if (!userAgent) {
        throwError('No mapped agent found for this user');
      }

      agentId = agent?.agentId;
      vapiPhoneNumberId = agent?.vapiPhoneNumberId;
    }

    // Create batch call with agent data
    const result = await batchCallService.create(request.user, {
      ...validatedPayload,
      recipients: recipientsForDb,
      assistantId: agentId,
      phoneNumberId: validatedPayload.phoneNumberId || vapiPhoneNumberId,
    });

    // Cleanup
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        Server.log.error(cleanupError, 'Error cleaning up uploaded file');
      }
    }

    // Clear cache periodically to prevent memory leaks
    if (phoneValidationCache.size > MAX_CACHE_SIZE * 0.8) {
      phoneValidationCache.clear();
    }

    return reply.send({
      success: true,
      data: result,
      message: `Batch call created successfully with ${validatedContacts.length} contacts`
    });
  } catch (error: any) {
    console.error('Error in createBatchCallHandler:', error);

    // Clean up uploaded file if it exists
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        Server.log.error(cleanupError, 'Error cleaning up uploaded file');
      }
    }

    // Return user-friendly error messages
    if (error instanceof ValidationError) {
      return reply.status(400).send({
        success: false,
        error: 'Batch Call Validation Error',
        message: error.message,
        details: error.details || [],
        suggestions: [
          'Ensure your CSV has columns: salutation, first_name, last_name, email, phone_number, client_id, gender, country',
          'Phone numbers should include country code (+49xxxxxxxxxx)',
          'Gender should be: masculine, feminine, neuter',
          'BmbyId should be a valid number',
          'Remove empty rows and duplicate phone numbers/BmbyIDs'
        ]
      });
    }

    // Generic error for unexpected issues
    return reply.status(500).send({
      success: false,
      error: 'Batch Call Creation Error',
      message: error.message || 'An unexpected error occurred while processing the file',
      details: []
    });
  }
}

// Rest of the handlers remain unchanged
export async function listBatchCallsHandler(request: any, reply: any) {
  try {
    request.query.skip = parseInt(request.query.skip) || 0;
    request.query.limit = parseInt(request.query.limit) || 10;
    const result = await batchCallService.listing(
      request.user,
      request.query
    );
    return reply.send(result);
  } catch (error) {
    throwError('Error listing batch calls', error);
  }
}












export async function getBatchCallDetailHandler(request: any, reply: any) {
  try {
    const batchCallId = request.params.id;
    const result = await batchCallService.getDetail(request.user, batchCallId);
    return reply.send(result);
  } catch (error) {
    throwError('Error fetching batch call detail', error);
  }
}

export async function batchCallStartHandler(request: any, reply: any) {
  try {
    const batchCallId = request.params.id;
    const { date, time } = request.body;
    const batchCall: any = await BatchCall.findOne({
      _id: new Types.ObjectId(batchCallId),
      isArchived: false
    }).lean();

    if (!batchCall) {
      throw new ValidationError(`Batch call with ID ${batchCallId} not found`);
    }
    if (batchCall.status !== BATCH_CALL_STATUS.DRAFT)
      throwError('BatchCall is not in a valid state to start');

    if (!date?.trim()) {
      throw new ValidationError('Date is required for scheduled calls');
    }
    if (!time?.trim()) {
      throw new ValidationError('Time is required for scheduled calls');
    }

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      throw new ValidationError('Date must be in YYYY-MM-DD format');
    }

    if (time && !/^\d{2}:\d{2}$/.test(time.trim())) {
      throw new ValidationError('Time must be in HH:MM format');
    }

    if (date?.trim() && time?.trim()) {
      try {
        const timezone: any = batchCall?.timezone;
        const dateTimeString = `${date.trim()}T${time.trim()}`;
        const scheduledMoment = moment.tz(dateTimeString, timezone);

        if (!scheduledMoment.isValid()) {
          throw new ValidationError('Invalid date/time format');
        } else {
          const scheduledUTC = scheduledMoment.utc();
          const currentUTC = moment.utc();
          const minScheduleUTC = currentUTC.clone().add(10, 'minutes');

          if (scheduledUTC.isBefore(minScheduleUTC)) {
            throw new ValidationError('Scheduled time must be at least 10 minutes from now');
          }
        }
      } catch (error: any) {
        throwError(error);
      }
    }

    const batchFollowUpsCall: any = await BatchCallFollowUps.find({
      batchCallId: new Types.ObjectId(batchCallId),
      isArchived: false,
    }).lean().exec();

    if (batchFollowUpsCall && batchFollowUpsCall.length > 0) {
      request.body.followUpsDetails = batchFollowUpsCall;
      request.body.timezone = batchCall?.timezone;
      request.body.schedule = batchCall?.schedule;
      const errors: any = checkFollowUpsDetails(request.body, [], true);
      if (errors.length > 0) {
        throw new ValidationError(`Validation failed with`, errors);
      }
    }

    const result = await batchCallService.batchCallStart(request.user, batchCallId, request.body);
    return reply.send(result);
  } catch (error: any) {
    // Return user-friendly error messages
    if (error instanceof ValidationError) {
      return reply.status(400).send({
        success: false,
        error: 'Batch Call Validation Error',
        message: error.message,
        details: error.details || [],
      });
    }

    // Generic error for unexpected issues
    return reply.status(500).send({
      success: false,
      error: 'Batch Call Start Error',
      message: error.message,
      details: []
    });
  }
}

export async function batchListBatchCallsHandler(request: any, reply: any) {
  try {
    const result = await batchCallService.batchListing(
      request.user,
      request.query.userId,
      request.query.companyId
    );
    return reply.send(result);
  } catch (error) {
    throwError('Error listing batch calls', error);
  }
}

export async function batchCallsDetailsHandler(request: any, reply: any) {
  try {
    const result = await batchCallService.batchCallDetails(request.user, request.body);
    return reply.send(result);
  } catch (error) {
    throwError('Error listing batch calls', error);
  }
}


export async function batchCallsFollowUpsHandler(request: any, reply: any) {
  try {
    const { batchCallId, timezone, followUpsDetails } = request.body;
    const errors: string[] = [];
    const validatedMoments: any = [];

    // Validate batch call ID exists
    if (!batchCallId?.trim()) {
      errors.push('Batch call ID is required');
    }

    const batchFollowUpsCall: any = await BatchCallFollowUps.find({
      batchCallId: new Types.ObjectId(batchCallId),
      isArchived: false,
    }).lean();

    if (batchFollowUpsCall && batchFollowUpsCall.length > 0) {
      errors.push('Follow-ups already exist for this batch call');
    }

    // Validate timezone
    if (!timezone?.trim()) {
      errors.push('Timezone is required');
    }

    // Validate followUpsDetails array
    if (!followUpsDetails || !Array.isArray(followUpsDetails) || followUpsDetails.length === 0) {
      errors.push('At least one follow-up detail is required');
    } else {

      for (let i = 0; i < followUpsDetails.length; i++) {
        const detail = followUpsDetails[i];
        const rowIndex = i + 1;

        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!detail.date?.trim()) {
          errors.push(`Row ${rowIndex}: Date is required`);
          continue;
        }
        if (!dateRegex.test(detail.date.trim())) {
          errors.push(`Row ${rowIndex}: Date must be in YYYY-MM-DD format`);
          continue;
        }

        // Validate time format (HH:MM)
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!detail.time?.trim()) {
          errors.push(`Row ${rowIndex}: Time is required`);
          continue;
        }
        if (!timeRegex.test(detail.time.trim())) {
          errors.push(`Row ${rowIndex}: Time must be in HH:MM format (24-hour)`);
          continue;
        }

        // Validate date/time combination with timezone
        try {
          const dateTimeString = `${detail.date.trim()}T${detail.time.trim()}`;
          const scheduledMoment = moment.tz(dateTimeString, timezone);

          if (!scheduledMoment.isValid()) {
            errors.push(`Row ${rowIndex}: Invalid date/time combination`);
            continue;
          }

          // Check if the date/time is in the past
          if (scheduledMoment.isBefore(moment())) {
            errors.push(`Row ${rowIndex}: Follow-up date/time cannot be in the past`);
            continue;
          }

          validatedMoments.push(scheduledMoment);
        } catch (error) {
          console.error('Moment validation error:', error);
          errors.push(`Row ${rowIndex}: Invalid date/time or timezone`);
        }
      }

      // Validate 24-hour difference between follow-up calls
      if (validatedMoments.length > 1) {
        // Sort moments by date/time
        const sortedMoments = [...validatedMoments].sort((a, b) => a.valueOf() - b.valueOf());

        for (let i = 1; i < sortedMoments.length; i++) {
          const previousMoment = sortedMoments[i - 1];
          const currentMoment = sortedMoments[i];
          const difference = currentMoment.diff(previousMoment, BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN, true);

          if (difference < BATCH_CALL_FOLLOWUPS_DIFF.DIFF_VALUE) {
            const originalIndex1 = validatedMoments.findIndex((m: { valueOf: () => any; }) => m.valueOf() === previousMoment.valueOf()) + 1;
            const originalIndex2 = validatedMoments.findIndex((m: { valueOf: () => any; }) => m.valueOf() === currentMoment.valueOf()) + 1;
            errors.push(`Follow-up calls must have at least ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_VALUE} ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN} difference (Row ${originalIndex1} and Row ${originalIndex2} are ${difference.toFixed(1)} ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN} apart)`);
          }
        }
      }

      // Check for duplicate date/time combinations
      const dateTimeStrings = new Set();
      followUpsDetails.forEach((detail, index) => {
        if (detail.date?.trim() && detail.time?.trim()) {
          const dateTimeKey = `${detail.date.trim()}_${detail.time.trim()}`;
          if (dateTimeStrings.has(dateTimeKey)) {
            errors.push(`Row ${index + 1}: Duplicate date/time combination found`);
          }
          dateTimeStrings.add(dateTimeKey);
        }
      });
    }

    // Validate batch ID exists and get original batch call details
    let originalBatchMoment: moment.Moment | null = null;
    try {
      const batchCall: any = await BatchCall.findOne({
        _id: new Types.ObjectId(batchCallId),
        isArchived: false,
      }).lean();

      if (!batchCall) {
        errors.push('Invalid batch call ID - batch does not exist');
      } else {
        // Get original batch call date/time
        if (batchCall.date && batchCall.time && batchCall.timezone) {
          const originalDateTimeString = `${batchCall.date}T${batchCall.time}`;
          originalBatchMoment = moment.tz(originalDateTimeString, batchCall.timezone);
        }
      }
    } catch (error) {
      console.error('Batch validation error:', error);
      errors.push('Error validating batch call ID');
    }

    // Validate 24-hour difference between original batch call and first follow-up
    if (originalBatchMoment && validatedMoments.length > 0) {
      const sortedMoments = [...validatedMoments].sort((a, b) => a.valueOf() - b.valueOf());
      const firstFollowUpMoment = sortedMoments[0];
      const difference = firstFollowUpMoment.diff(originalBatchMoment, BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN, true);

      if (difference < BATCH_CALL_FOLLOWUPS_DIFF.DIFF_VALUE) {
        const originalIndex = validatedMoments.findIndex((m: { valueOf: () => any; }) => m.valueOf() === firstFollowUpMoment.valueOf()) + 1;
        errors.push(`First follow-up call must have at least ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN} ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_VALUE} difference from original batch call (currently ${difference.toFixed(1)} ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN} apart - Row ${originalIndex})`);
      }
    }

    // Return validation errors if any
    if (errors.length > 0) {
      return reply.code(400).send({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }
    request.body.status = BATCH_CALL_STATUS.START_CALLING;

    // Proceed with the service call if validation passes
    const result = await batchCallService.batchCallsFollowUp(request.user, request.body);
    return reply.send(result);

  } catch (error) {
    console.error('Handler error:', error);
    throw error;
  }
}

export async function deleteHandler(request: any, reply: any) {
  try {
    const requestedId = request.params.id;
    const requestedType = request.params.type; // batch, followups

    // Validate input parameters
    if (!requestedId) {
      return reply.status(400).send({
        success: false,
        message: 'ID is required'
      });
    }

    if (!requestedType || !['batch', 'followups'].includes(requestedType)) {
      return reply.status(400).send({
        success: false,
        message: 'Type must be either "batch" or "followups"'
      });
    }

    // Convert string ID to ObjectId if needed
    const objectId = new Types.ObjectId(requestedId);

    // Get current time and CALL_DELETE_BEFORE.DIFF_VALUE minutes from now
    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + CALL_DELETE_BEFORE.DIFF_VALUE * 60 * 1000);

    if (requestedType === 'batch') {
      // Handle batch deletion
      await deleteBatchAndFollowUps(request, objectId, thirtyMinutesFromNow, reply);
    } else {
      // Handle followup deletion
      await deleteFollowUp(request, objectId, thirtyMinutesFromNow, reply);
    }

  } catch (error: any) {
    console.error('Error in deleteHandler:', error);
    return reply.status(500).send({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}

async function deleteBatchAndFollowUps(request: any, batchId: any, thirtyMinutesFromNow: any, reply: any) {
  try {
    // Find the batch
    const batch = await BatchCall.findById(batchId);

    if (!batch) {
      return reply.status(404).send({
        success: false,
        message: 'Batch not found'
      });
    }

    // Check if batch can be deleted
    const batchCanBeDeleted = canDelete(batch, thirtyMinutesFromNow);
    if (!batchCanBeDeleted.canDelete) {
      return reply.status(400).send({
        success: false,
        message: `Cannot delete batch: ${batchCanBeDeleted.reason}`
      });
    }
    // Find all followups for this batch
    const followUps = await BatchCallFollowUps.find({ batchCallId: batchId });

    if (batch?.status !== BATCH_CALL_STATUS.DRAFT) {
      // Check if all followups can be deleted
      for (const followUp of followUps) {
        const followUpCanBeDeleted = canDelete(followUp, thirtyMinutesFromNow);
        if (!followUpCanBeDeleted.canDelete) {
          return reply.status(400).send({
            success: false,
            message: `Cannot delete batch: One or more followups ${followUpCanBeDeleted.reason}`
          });
        }
      }
    }


    // Delete
    await batchCallService.deleteBatchAndFollowUps(request.user, request.params);

    return reply.send({
      success: true,
      message: `Batch and ${followUps.length} followup(s) deleted successfully`,
      deletedCount: {
        batch: 1,
        followUps: followUps.length
      }
    });

  } catch (error) {
    throw error;
  }
}

async function deleteFollowUp(request: any, followUpId: any, thirtyMinutesFromNow: any, reply: any) {
  try {

    // Find the followup
    const followUp = await BatchCallFollowUps.findById(followUpId);

    // Find the batch
    const batch = await BatchCall.findById(followUp?.batchCallId);

    if (!followUp) {
      return reply.status(404).send({
        success: false,
        message: 'FollowUp not found'
      });
    }
    if (batch?.status !== BATCH_CALL_STATUS.DRAFT) {
      // Check if followup can be deleted
      const canDeleteResult = canDelete(followUp, thirtyMinutesFromNow);
      if (!canDeleteResult.canDelete) {
        return reply.status(400).send({
          success: false,
          message: `Cannot delete followup: ${canDeleteResult.reason}`
        });
      }
    }
    // Delete
    await batchCallService.deleteCalls(request.user, request.params);

    return reply.send({
      success: true,
      message: 'FollowUp deleted successfully',
      deletedCount: {
        followUps: 1
      }
    });

  } catch (error) {
    throw error;
  }
}

function canDelete(record: any, thirtyMinutesFromNow: any) {
  // Check if status is running (IN_PROCESS or START_CALLING)
  if (record.status === BATCH_CALL_STATUS.IN_PROCESS) {
    return {
      canDelete: false,
      reason: 'is currently running'
    };
  }
  if (record.status === BATCH_CALL_STATUS.DRAFT) {
    return {
      canDelete: true,
      reason: null
    };
  }

  // Check if scheduled within next 30 minutes
  const newUtcDateTime = moment(thirtyMinutesFromNow).utc().toDate();
  if (record.utcDateTime && record.utcDateTime <= newUtcDateTime && record.utcDateTime > new Date()) {
    return {
      canDelete: false,
      reason: 'is scheduled to run within the next 30 minutes'
    };
  }

  return {
    canDelete: true,
    reason: null
  };
}

export async function createBatchCallFromCallsHandler(request: any, reply: any) {
  try {
    const payload = request.body;

    // Check profile completion
    if (!request.user.profileCompletion) {
      return reply.status(400).send({
        success: false,
        error: 'Profile Incomplete',
        message: 'Please complete your user profile before creating batch calls',
        details: []
      });
    }

    // Validate required fields
    if (!payload.callIds?.length || !payload.name) {
      return reply.status(400).send({
        success: false,
        error: 'Validation Error',
        message: 'callIds array and name are required',
        details: []
      });
    }

    // Validate outbound number is required
    if (!payload.outboundNumber?.trim()) {
      return reply.status(400).send({
        success: false,
        error: 'Validation Error',
        message: 'Outbound number is required',
        details: []
      });
    }

    // Validate outbound number format
    if (!validatePhone(payload.outboundNumber.trim())) {
      return reply.status(400).send({
        success: false,
        error: 'Validation Error',
        message: 'Invalid outbound number format',
        details: []
      });
    }

    // Convert callIds to ObjectIds properly
    const callObjectIds = payload.callIds.map((id: string) => {
      try {
        // Remove 'call_' prefix if present
        const cleanId = id.startsWith('call_') ? id.substring(5) : id;
        return new Types.ObjectId(cleanId);
      } catch (err) {
        throw new ValidationError(`Invalid call ID format: ${id}`);
      }
    });

    // Fetch calls - removed lean() to get full documents
    const calls = await Call.find({
      _id: { $in: callObjectIds },
      createdBy: new Types.ObjectId(request.user.userId)
    });

    if (!calls.length) {
      return reply.status(404).send({
        success: false,
        error: 'Not Found',
        message: 'No calls found with the provided callIds for this user',
        details: []
      });
    }

    // Build recipients array with proper validation
    const recipients = calls.map((call: any) => {
      // Determine phone number
      const phoneNumber = call.number || call.toNumber || '';
      if (!phoneNumber) {
        throw new ValidationError(`Call ${call._id} has no phone number`);
      }

      // Validate phone number
      if (!validatePhone(phoneNumber)) {
        throw new ValidationError(`Call ${call._id} has invalid phone number: ${phoneNumber}`);
      }

      return {
        salutation: call.salutation || (call.gender?.toLowerCase() === 'masculine' ? 'Herr' : call.gender?.toLowerCase() === 'feminine' ? 'Frau' : ''),
        firstName: call.firstName || '',
        lastName: call.lastName || '',
        email: call.email || '',
        number: phoneNumber, // Use 'number' to match Contact interface
        gender: call.gender?.toLowerCase() || 'other',
        country: call.country || '',
        bmbyId: call.bmbyId || 0, // Provide default if missing
        callRecordId: call._id.toString()
      };
    });

    // Validate schedule-related fields
    const schedule = payload.schedule === 'true' || payload.schedule === true;
    let validatedPayload: any = {
      name: payload.name.trim(),
      status: payload.status ? parseInt(payload.status) : BATCH_CALL_STATUS.DRAFT,
      agentId: payload.agentId?.trim() || undefined,
      leadGroupId: payload.leadGroupId?.trim() || undefined,
      outboundNumber: payload.outboundNumber.trim(),
      schedule,
      timezone: payload.timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    // Handle scheduling and date/time fields based on schedule flag
    if (schedule) {
      // When schedule is true, date and time are REQUIRED
      if (!payload.date?.trim()) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Date is required for scheduled calls',
          details: []
        });
      }
      if (!payload.time?.trim()) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Time is required for scheduled calls',
          details: []
        });
      }

      // Validate date/time format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date.trim())) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Date must be in YYYY-MM-DD format',
          details: []
        });
      }

      if (!/^\d{2}:\d{2}$/.test(payload.time.trim())) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Time must be in HH:MM format',
          details: []
        });
      }

      const timezone = validatedPayload.timezone;
      const dateTimeString = `${payload.date.trim()}T${payload.time.trim()}`;
      const scheduledMoment = moment.tz(dateTimeString, timezone);

      if (!scheduledMoment.isValid()) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Invalid date/time format',
          details: []
        });
      }

      const scheduledUTC = scheduledMoment.utc();
      const currentUTC = moment.utc();
      const minScheduleUTC = currentUTC.clone().add(10, 'minutes');

      if (scheduledUTC.isBefore(minScheduleUTC)) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Scheduled time must be at least 10 minutes from now',
          details: []
        });
      }

      // Set the validated date and time
      validatedPayload.date = payload.date.trim();
      validatedPayload.time = payload.time.trim();
    } else {
      // When schedule is false, generate current date/time for validation purposes
      // These will be recalculated in the service, but needed for follow-up validation
      const timezone = validatedPayload.timezone;
      const now = moment.tz(timezone);
      validatedPayload.date = now.format('YYYY-MM-DD');
      validatedPayload.time = now.format('HH:mm');
    }

    // Validate follow-ups if provided
    if (Array.isArray(payload.followUpsDetails) && payload.followUpsDetails.length > 0) {
      // Add follow-ups to validatedPayload before validation
      validatedPayload.followUpsDetails = payload.followUpsDetails;

      // Validate follow-ups - pass empty errors array and fromStartCall flag
      const errors: string[] = [];
      checkFollowUpsDetails(validatedPayload, errors, false);

      if (errors.length > 0) {
        return reply.status(400).send({
          success: false,
          error: 'Validation Error',
          message: 'Follow-up validation failed',
          details: errors
        });
      }
    } else {
      // No follow-ups provided
      validatedPayload.followUpsDetails = [];
    }

    // Create batch call using the service
    const result = await batchCallService.create(request.user, {
      ...validatedPayload,
      recipients
    });

    return reply.send({
      success: true,
      data: result,
      message: `Batch call created successfully with ${recipients.length} contacts`
    });

  } catch (error: any) {
    console.error('Error in createBatchCallFromCallsHandler:', error);

    // Handle validation errors
    if (error instanceof ValidationError) {
      return reply.status(400).send({
        success: false,
        error: 'Validation Error',
        message: error.message,
        details: error.details || []
      });
    }

    // Generic error for unexpected issues
    return reply.status(500).send({
      success: false,
      error: 'Batch Call Creation Error',
      message: error.message || 'An unexpected error occurred',
      details: []
    });
  }
}


export async function retryBatchCallRequestHandler(request: any, reply: any) {
  try {
    const result = await batchCallService.retryBatchCall(request.user, request.body);
    return reply.send(result);
  } catch (error: any) {
    throwError(error);
  }
}


export async function retryFollowupsBatchCallRequestHandler(request: any, reply: any) {
  try {
    const result = await batchCallService.retryFollowupsBatchCall(request.user, request.body);
    return reply.send(result);
  } catch (error: any) {
    console.log(error)
    throwError(error);
  }
}


export async function processPendingBatchCallRequestHandler(request: any, reply: any) {
  try {
    const result = await batchCallService.processPendingBatchCall(request.user, request.body);
    return reply.send(result);
  } catch (error: any) {
    console.log(error)
    throwError(error);
  }
}
