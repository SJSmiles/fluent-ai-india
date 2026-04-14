import { batchCallService } from '../services/batchCall.service';
import { Server } from '../../../server';
import { throwError, uploadDir } from '../../../common/app-helper';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { pipeline as _pipeline } from 'stream';
import moment from 'moment-timezone';
import { Agent } from '../../agent/models/agent.model';
import { Company } from '../../company/models/company.model';
import { UserAgent } from '../../agent/models/user-agent.model';
import { BlackList } from '../../black-list/models/black-list.model';
import * as XLSX from 'xlsx';

const pipeline = promisify(_pipeline);

// ── Constants ─────────────────────────────────────────────────────────────────
const BATCH_SIZE = 1000;
const phoneValidationCache = new Map<string, string | null>();
const MAX_CACHE_SIZE = 50000;

// ── Error class ───────────────────────────────────────────────────────────────
class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ── Validators ────────────────────────────────────────────────────────────────
function isValidPhone(number: string): string | null {
  const trimmed = number.trim();
  if (phoneValidationCache.has(trimmed)) return phoneValidationCache.get(trimmed) ?? null;

  const phoneRegex = /^\+?[\d\s\-\(\)]{7,15}$/;
  if (!phoneRegex.test(trimmed)) {
    if (phoneValidationCache.size < MAX_CACHE_SIZE) phoneValidationCache.set(trimmed, null);
    return null;
  }

  const result = !trimmed.startsWith('+') ? '+' + trimmed : trimmed;
  if (phoneValidationCache.size < MAX_CACHE_SIZE) phoneValidationCache.set(trimmed, result);
  return result;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@\.]+$/.test(email.trim());
}

// ── Parse uploaded file (CSV / XLSX) ─────────────────────────────────────────
async function parseUploadedFile(filePath: string): Promise<any[]> {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

// ── Validate contacts against company csvColumnConfig ────────────────────────
function validateContactsBatch(
  contacts: any[],
  startIndex: number,
  blacklistedNumbers: Set<string>,
  columnConfig: any[]
): { valid: any[]; processed: any[] } {
  const validatedContacts: any[] = [];
  const processedContacts: any[] = [];
  const numberSet = new Set<string>();

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const rowIndex = startIndex + i + 2;
    const rowErrors: string[] = [];
    let isBlacklisted = false;
    let contactNumber: string | null = null;
    const validatedContact: any = {};

    try {
      for (const col of columnConfig) {
        const rawValue = contact[col.name]?.toString().trim() ?? '';

        // Required check
        if (col.required && !rawValue) {
          rowErrors.push(`${col.label || col.name} is required`);
          continue;
        }

        // Type validation
        if (rawValue) {
          if (col.type === 'phone') {
            const validated = isValidPhone(rawValue.replace(/\s+/g, ''));
            if (!validated) {
              rowErrors.push(`${col.label || col.name}: Invalid phone number format`);
            } else {
              contactNumber = validated;
              validatedContact[col.name] = validated;
            }
          } else if (col.type === 'email') {
            if (!isValidEmail(rawValue)) {
              rowErrors.push(`${col.label || col.name}: Invalid email format`);
            } else {
              validatedContact[col.name] = rawValue.toLowerCase();
            }
          } else if (col.type === 'number') {
            if (isNaN(Number(rawValue))) {
              rowErrors.push(`${col.label || col.name}: Must be a number`);
            } else {
              validatedContact[col.name] = rawValue;
            }
          } else if (col.type === 'boolean') {
            if (!['true', 'false', '1', '0'].includes(rawValue.toLowerCase())) {
              rowErrors.push(`${col.label || col.name}: Must be true or false`);
            } else {
              validatedContact[col.name] = rawValue;
            }
          } else if (col.type === 'string') {
            // Enum check
            if (col.enum?.length > 0 && !col.enum.includes(rawValue)) {
              rowErrors.push(`${col.label || col.name}: Must be one of: ${col.enum.join(', ')}`);
            } else {
              validatedContact[col.name] = rawValue;
            }
          } else {
            validatedContact[col.name] = rawValue;
          }
        } else {
          validatedContact[col.name] = '';
        }
      }

      // Phone specific checks
      if (contactNumber) {
        if (blacklistedNumbers.has(contactNumber)) {
          isBlacklisted = true;
          rowErrors.push('This number is in the Do Not Contact list');
        } else if (numberSet.has(contactNumber)) {
          rowErrors.push(`Duplicate phone number '${contactNumber}'`);
        }
      }

      if (isBlacklisted) {
        processedContacts.push({ row: rowIndex, originalData: contact, status: 'blacklisted', errors: rowErrors });
      } else if (rowErrors.length > 0) {
        processedContacts.push({ row: rowIndex, originalData: contact, status: 'failed', errors: rowErrors });
      } else if (contactNumber) {
        numberSet.add(contactNumber);
        validatedContacts.push(validatedContact);
        processedContacts.push({ row: rowIndex, originalData: contact, validatedData: validatedContact, status: 'success', errors: [] });
      }
    } catch (error: any) {
      processedContacts.push({ row: rowIndex, originalData: contact, status: 'failed', errors: [error.message || 'Validation error'] });
    }
  }

  return { valid: validatedContacts, processed: processedContacts };
}

// ── Generate validation report Excel ─────────────────────────────────────────
function generateValidationReport(processedContacts: any[], columnConfig: any[]): Buffer {
  const workbook = XLSX.utils.book_new();

  // Find phone column name
  const phoneCol = columnConfig.find(c => c.type === 'phone')?.name || 'phone_number';

  const validContacts = processedContacts.filter(c => c.status === 'success');
  if (validContacts.length > 0) {
    const validData = validContacts.map(pc => {
      const row: any = { Row: pc.row };
      columnConfig.forEach(col => { row[col.label || col.name] = pc.validatedData?.[col.name] || ''; });
      row['Validation Status'] = 'SUCCESS';
      row['Error Messages'] = 'No errors';
      return row;
    });
    const validSheet = XLSX.utils.json_to_sheet(validData);
    XLSX.utils.book_append_sheet(workbook, validSheet, 'Valid Contacts');
  }

  const invalidContacts = processedContacts.filter(c => c.status === 'failed');
  if (invalidContacts.length > 0) {
    const invalidData = invalidContacts.map(pc => {
      const row: any = { Row: pc.row };
      columnConfig.forEach(col => { row[col.label || col.name] = pc.originalData?.[col.name] || ''; });
      row['Validation Status'] = 'FAILED';
      row['Error Messages'] = pc.errors.join('; ');
      return row;
    });
    const invalidSheet = XLSX.utils.json_to_sheet(invalidData);
    XLSX.utils.book_append_sheet(workbook, invalidSheet, 'Invalid Contacts');
  }

  const blacklisted = processedContacts.filter(c => c.status === 'blacklisted');
  if (blacklisted.length > 0) {
    const blacklistedData = blacklisted.map(pc => {
      const row: any = { Row: pc.row };
      columnConfig.forEach(col => { row[col.label || col.name] = pc.originalData?.[col.name] || ''; });
      row['Validation Status'] = 'BLACKLISTED';
      row['Reason'] = 'Number is in Do Not Contact list';
      return row;
    });
    const blacklistedSheet = XLSX.utils.json_to_sheet(blacklistedData);
    XLSX.utils.book_append_sheet(workbook, blacklistedSheet, 'Blacklisted');
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

// ── Parse & validate full file ────────────────────────────────────────────────
async function parseAndValidateFile(
  filePath: string,
  companyId: any,
  columnConfig: any[]
): Promise<{
  validContacts: any[];
  allProcessedContacts: any[];
  reportBuffer: Buffer;
  summary: { total: number; valid: number; invalid: number; blacklisted: number };
}> {
  const contacts = await parseUploadedFile(filePath);

  if (!Array.isArray(contacts) || contacts.length === 0) {
    throw new ValidationError('File contains no valid contacts');
  }

  // Validate required columns exist in file
  const firstContact = contacts[0];
  const availableKeys = Object.keys(firstContact).map(k => k.replace(/^\uFEFF/, '').trim().toLowerCase());
  const requiredCols = columnConfig.filter(c => c.required).map(c => c.name.toLowerCase());
  const missingCols = requiredCols.filter(col => !availableKeys.includes(col));

  if (missingCols.length > 0) {
    throw new ValidationError(
      `Missing required columns: ${missingCols.join(', ')}. Available columns: ${availableKeys.join(', ')}`
    );
  }

  // Normalize keys
  const normalizedContacts = contacts.map(contact => {
    const normalized: any = {};
    Object.keys(contact).forEach(key => {
      normalized[key.replace(/^\uFEFF/, '').trim().toLowerCase()] = contact[key];
    });
    return normalized;
  });

  // Normalize columnConfig names to lowercase for matching
  const normalizedConfig = columnConfig.map(c => ({ ...c, name: c.name.toLowerCase() }));

  // Fetch blacklisted numbers for this company
  const blacklistEntries = await BlackList.find({
    companyId,
    isArchived: false
  }).select('toNumber').lean();
  const blacklistedNumbers = new Set<string>(blacklistEntries.map((b: any) => b.toNumber));

  const validatedContacts: any[] = [];
  const allProcessedContacts: any[] = [];
  const globalNumberSet = new Set<string>();
  let blacklistedCount = 0;

  for (let i = 0; i < normalizedContacts.length; i += BATCH_SIZE) {
    const batch = normalizedContacts.slice(i, i + BATCH_SIZE);
    const { valid, processed } = validateContactsBatch(batch, i, blacklistedNumbers, normalizedConfig);

    for (const pc of processed) {
      if (pc.status === 'success' && pc.validatedData) {
        const phoneCol = normalizedConfig.find(c => c.type === 'phone')?.name;
        const phoneValue = phoneCol ? pc.validatedData[phoneCol] : null;

        if (phoneValue && globalNumberSet.has(phoneValue)) {
          pc.status = 'failed';
          pc.errors = [`Duplicate phone number '${phoneValue}' found across file`];
        } else {
          if (phoneValue) globalNumberSet.add(phoneValue);
          validatedContacts.push(pc.validatedData);
        }
      } else if (pc.status === 'blacklisted') {
        blacklistedCount++;
      }
      allProcessedContacts.push(pc);
    }

    if (i + BATCH_SIZE < normalizedContacts.length) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  const reportBuffer = generateValidationReport(allProcessedContacts, normalizedConfig);

  return {
    validContacts: validatedContacts,
    allProcessedContacts,
    reportBuffer,
    summary: {
      total: contacts.length,
      valid: validatedContacts.length,
      invalid: allProcessedContacts.filter(c => c.status !== 'success').length,
      blacklisted: blacklistedCount
    }
  };
}

// ── Payload validator ─────────────────────────────────────────────────────────
function validateBatchCallPayload(formData: any) {
  const errors: string[] = [];

  if (!formData.name?.trim()) errors.push('Batch call name is required');
  if (!formData.agentId?.trim()) errors.push('Agent ID is required');
  if (!formData.date?.trim()) errors.push('Date is required (YYYY-MM-DD)');
  if (!formData.time?.trim()) errors.push('Time is required (HH:MM)');
  if (!formData.phoneNumber?.trim()) errors.push('Phone number is required');

  if (formData.date && !/^\d{4}-\d{2}-\d{2}$/.test(formData.date.trim())) {
    errors.push('Date must be in YYYY-MM-DD format');
  }

  if (formData.time && !/^\d{2}:\d{2}$/.test(formData.time.trim())) {
    errors.push('Time must be in HH:MM format');
  }

  if (formData.date?.trim() && formData.time?.trim()) {
    const timezone = formData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const scheduledMoment = moment.tz(`${formData.date.trim()}T${formData.time.trim()}`, timezone);
    if (!scheduledMoment.isValid()) {
      errors.push('Invalid date/time');
    } else if (scheduledMoment.utc().isBefore(moment.utc().add(10, 'minutes'))) {
      errors.push('Scheduled time must be at least 10 minutes from now');
    }
  }

  // Parse followUpsDetails
  let followUpsDetails: any[] = [];
  if (formData.followUpsDetails) {
    followUpsDetails = Array.isArray(formData.followUpsDetails)
      ? formData.followUpsDetails
      : JSON.parse(formData.followUpsDetails);
  }

  if (errors.length > 0) throw new ValidationError('Validation failed', errors);

  return {
    name: formData.name.trim(),
    agentId: formData.agentId.trim(),
    timezone: formData.timezone?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone,
    date: formData.date.trim(),
    time: formData.time.trim(),
    followUpsDetails,
    phoneNumber: formData.phoneNumber?.trim() || undefined
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function createBatchCall(request: any, reply: any) {
  let filePath: string | null = null;

  try {
    const user = request.user;

    // Parse multipart form
    const parts = request.parts();
    let formData: Record<string, any> = {};
    let fileName = 'uploaded_file';

    for await (const part of parts) {
      if (part.file) {
        fileName = part.filename;
        filePath = path.join(uploadDir(), part.filename);
        await pipeline(part.file, fs.createWriteStream(filePath));
      } else {
        formData[part.fieldname] = part.value;
      }
    }

    if (!filePath) throw new ValidationError('No file uploaded');

    // Validate payload
    const validatedPayload = validateBatchCallPayload(formData);

    // Fetch company and its csvColumnConfig
    const company: any = await Company.findOne({
      _id: user.companyId,
      isArchived: false
    }).select('name csvColumnConfig').lean();

    if (!company) {
      return reply.status(404).send({ success: false, message: 'Company not found' });
    }

    // Use company csvColumnConfig or fallback defaults
    const columnConfig: any[] = company.csvColumnConfig?.length > 0
      ? company.csvColumnConfig
      : [
        { name: 'phone_number', label: 'Phone Number', type: 'phone', required: true },
        { name: 'first_name', label: 'First Name', type: 'string', required: true },
        { name: 'last_name', label: 'Last Name', type: 'string', required: false },
        { name: 'email', label: 'Email', type: 'email', required: false },
      ];

    // Validate agent exists and user has access
    const agent: any = await Agent.findOne({
      _id: validatedPayload.agentId,
      companyId: user.companyId,
      isArchived: false
    }).lean();

    if (!agent) {
      cleanup(filePath);
      return reply.status(404).send({ success: false, message: 'Agent not found' });
    }

    const userAgent: any = await UserAgent.findOne({
      userId: user.userId,
      agentId: agent._id,
      isArchived: false
    }).lean();

    if (!userAgent) {
      cleanup(filePath);
      return reply.status(403).send({ success: false, message: 'User does not have access to this agent' });
    }

    // Parse and validate file
    const { validContacts, allProcessedContacts, reportBuffer, summary } =
      await parseAndValidateFile(filePath, user.companyId, columnConfig);

    cleanup(filePath);

    if (allProcessedContacts.length === 0) {
      return reply.status(400).send({
        success: false,
        message: 'The uploaded file contains no contacts'
      });
    }

    if (validContacts.length === 0) {
      return reply.send({
        success: true,
        data: null,
        message: 'No valid contacts found. Batch call not created.',
        summary,
        validationReport: {
          buffer: reportBuffer.toString('base64'),
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      });
    }

    // Create batch call
    const result = await batchCallService.create(user, {
      ...validatedPayload,
      agentMongoId: agent._id,
      recipients: validContacts
    });

    if (phoneValidationCache.size > MAX_CACHE_SIZE * 0.8) phoneValidationCache.clear();

    return reply.send({
      success: true,
      data: result,
      message: summary.invalid > 0
        ? `Batch call created with ${validContacts.length} valid contacts. ${summary.invalid} contacts excluded.`
        : `Batch call created successfully with ${validContacts.length} contacts`,
      summary,
      validationReport: {
        buffer: reportBuffer.toString('base64'),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    });

  } catch (error: any) {
    cleanup(filePath);

    if (error instanceof ValidationError) {
      return reply.status(400).send({
        success: false,
        message: error.message,
        details: error.details || []
      });
    }

    Server.log.error(error, 'Error in createBatchCall');
    return reply.status(500).send({
      success: false,
      message: error.message || 'An unexpected error occurred'
    });
  }
}

// ── Cleanup helper ────────────────────────────────────────────────────────────
function cleanup(filePath: string | null) {
  if (filePath && fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (_) { }
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