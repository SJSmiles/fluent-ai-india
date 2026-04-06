import { batchCallService } from '../services/batchCall.service';
import { Server } from '../../../server';
import { uploadDir } from '../../../common/app-helper';
import parseFile, { validatePhone } from '../helpers/helper';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { pipeline as _pipeline } from 'stream';
import {
  BATCH_CALL_FOLLOWUPS_DIFF,
  BATCH_CALL_START_AFTER,
  BATCH_CALL_STATUS,
  PM_QUALI_COMPANY_ID
} from '../../../config/server-config';
import moment from 'moment';
import { Agent } from '../../agent/model/agent.model';
import { Company } from '../../company/models/company.model';
import { UserAgent } from '../../agent/model/user-agent.model';
import * as XLSX from 'xlsx';
import { BlackList } from '../../black-list/models/black-list.model';
import { Contact } from '../../contact/models/contact.model';
const pipeline = promisify(_pipeline);

// Validation schemas and types
interface Contact {
  number: string;
  gender: 'masculine' | 'feminine' | 'neuter' | 'male' | 'female' | '' | null;
  firstName: string;
  lastName: string;
  email: string;
  country?: string;
  salutation?: string;
}

interface ProcessedContact {
  row: number;
  originalData: any;
  validatedData?: Contact;
  status: 'success' | 'failed' | 'blacklisted' | 'contact_not_found';
  errors: string[];
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
  isContactSheet?: boolean;
}

// Validation utilities
const VALID_GENDERS = new Set(['masculine', 'feminine', 'neuter', 'male', 'female', '', null]);
const REQUIRED_CSV_COLUMNS = [
  'salutation',
  'phone_number',
  'gender',
  'first_name',
  'last_name',
  'email',
  'client_id',
  'country'
] as const;
const BATCH_SIZE = 1000;
const REQUIRED_CONTACT_SHEET_COLUMNS = ['email', 'first_name', 'last_name'] as const;

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
const MAX_CACHE_SIZE = 50000;

function isValidPhone(number: string): string | null {
  const trimmedNumber = number.trim();

  if (phoneValidationCache.has(trimmedNumber)) {
    return phoneValidationCache.get(trimmedNumber)!;
  }

  const phoneRegex = /^\+?[\d\s\-\(\)]{7,15}$/;

  if (!phoneRegex.test(trimmedNumber)) {
    if (phoneValidationCache.size < MAX_CACHE_SIZE) {
      phoneValidationCache.set(trimmedNumber, null);
    }
    return null;
  }

  const result = !trimmedNumber.startsWith('+') ? '+' + trimmedNumber : trimmedNumber;

  if (phoneValidationCache.size < MAX_CACHE_SIZE) {
    phoneValidationCache.set(trimmedNumber, result);
  }

  return result;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@\.]+$/;
  return emailRegex.test(email.trim());
}

function validateContactsBatch(
  contacts: any[],
  startIndex: number,
  blacklistedNumbers: Set<string>
): { valid: Contact[]; processed: ProcessedContact[] } {
  const validatedContacts: Contact[] = [];
  const processedContacts: ProcessedContact[] = [];
  const numberSet = new Set<string>();

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const rowIndex = startIndex + i + 2;
    const rowErrors: string[] = [];
    let isBlacklisted = false;

    try {
      const numberStr = contact.phone_number?.toString().trim()?.replace(/\s+/g, '');
      const salutationStr = contact.salutation?.toString().trim();
      const firstNameStr = contact.first_name?.toString().trim();
      const lastNameStr = contact.last_name?.toString().trim();
      const genderStr = contact.gender?.toString().trim().toLowerCase();
      const emailStr: any = contact.email?.toString().trim().toLowerCase();
      const countryStr = contact.country?.toString().trim();
      const contactIdStr = contact.client_id?.toString().trim() || '';

      // Collect all errors for this row
      if (!numberStr) {
        rowErrors.push('Phone number is required');
      }

      if (!firstNameStr) {
        rowErrors.push('First name is required');
      }

      if (genderStr && !VALID_GENDERS.has(genderStr)) {
        rowErrors.push('Gender must be one of:  masculine, feminine, neuter or empty');
      }

      if (emailStr && !isValidEmail(emailStr)) {
        rowErrors.push('Email is in invalid format');
      }

      // Validate phone number
      let contactNumber: string | null = null;
      if (numberStr) {
        contactNumber = isValidPhone(numberStr);
        if (!contactNumber) {
          rowErrors.push('Invalid phone number format');
        } else {
          try {
            if (!validatePhone(contactNumber)) {
              rowErrors.push(
                `Invalid phone number format, Please add with country code like(+49xxxxxxxxxx)`
              );
              contactNumber = null;
            } else {
              if (blacklistedNumbers.has(contactNumber)) {
                isBlacklisted = true;
                rowErrors.push('This number is in the Do Not Contact list');
              }
            }
          } catch (error) {
            rowErrors.push('Invalid phone number format');
            contactNumber = null;
          }
        }
      }



      // Check for duplicates only if not blacklisted
      if (contactNumber && !isBlacklisted && numberSet.has(contactNumber)) {
        rowErrors.push(`Duplicate Phone Number '${contactNumber}'`);
      }


      if (isBlacklisted) {
        // Blacklisted contact - don't add to valid list but report separately
        processedContacts.push({
          row: rowIndex,
          originalData: contact,
          status: 'blacklisted',
          errors: rowErrors
        });
      } else if (rowErrors.length > 0) {
        // Other validation errors
        processedContacts.push({
          row: rowIndex,
          originalData: contact,
          status: 'failed',
          errors: rowErrors
        });
      } else if (contactNumber) {
        // Valid contact
        numberSet.add(contactNumber);

        const validatedContact: any = {
          number: contactNumber,
          salutation: salutationStr,
          gender: genderStr ? genderStr.toLowerCase() : '',
          firstName: firstNameStr,
          lastName: lastNameStr,
          email: emailStr,
          country: countryStr,
          leadContactId: contactIdStr
        };

        validatedContacts.push(validatedContact);
        processedContacts.push({
          row: rowIndex,
          originalData: contact,
          validatedData: validatedContact,
          status: 'success',
          errors: []
        });
      }
    } catch (error: any) {
      processedContacts.push({
        row: rowIndex,
        originalData: contact,
        status: 'failed',
        errors: [error.message || 'Validation error']
      });
    }
  }

  return { valid: validatedContacts, processed: processedContacts };
}

async function fetchContactsByEmail(emails: string[], userId: string): Promise<Map<string, any>> {
  try {
    const contacts = await Contact.find({
      email: { $in: emails },
      createdBy: userId,
      isArchived: false
    });

    const contactMap = new Map<string, any>();
    contacts.forEach((contact) => {
      contactMap.set(contact.email.toLowerCase(), contact);
    });

    return contactMap;
  } catch (error) {
    Server.log.error(error, 'Error fetching contacts from database');
    throw new Error('Failed to fetch contacts from database');
  }
}

async function validateContactSheetBatch(
  contacts: any[],
  startIndex: number,
  blacklistedNumbers: Set<string>,
  userId: string
): Promise<{ valid: Contact[]; processed: ProcessedContact[] }> {
  const validatedContacts: Contact[] = [];
  const processedContacts: ProcessedContact[] = [];

  const emailSet = new Set<string>();

  const emails = contacts
    .map((c) => c.email?.toString().trim().toLowerCase())
    .filter((email) => email && isValidEmail(email));

  const contactMap = await fetchContactsByEmail(emails, userId);

  for (let i = 0; i < contacts.length; i++) {
    const csvRow = contacts[i];
    const rowIndex = startIndex + i + 2;
    const rowErrors: string[] = [];
    let isBlacklisted = false;

    try {
      const emailStr = csvRow.email?.toString().trim().toLowerCase();

      if (!emailStr) {
        rowErrors.push('Email is required');
        processedContacts.push({
          row: rowIndex,
          originalData: csvRow,
          status: 'failed',
          errors: rowErrors
        });
        continue;
      }

      if (!isValidEmail(emailStr)) {
        rowErrors.push('Email is in invalid format');
        processedContacts.push({
          row: rowIndex,
          originalData: csvRow,
          status: 'failed',
          errors: rowErrors
        });
        continue;
      }

      if (emailSet.has(emailStr)) {
        rowErrors.push(`Duplicate email '${emailStr}' in CSV file`);
        processedContacts.push({
          row: rowIndex,
          originalData: csvRow,
          status: 'failed',
          errors: rowErrors
        });
        continue;
      }
      emailSet.add(emailStr);

      const contactData = contactMap.get(emailStr);

      if (!contactData) {
        processedContacts.push({
          row: rowIndex,
          originalData: csvRow,
          status: 'contact_not_found',
          errors: [`Contact not found for email: ${emailStr}`]
        });
        continue;
      }

      const csvFirstName = csvRow.first_name?.toString().trim();
      const csvLastName = csvRow.last_name?.toString().trim();

      let firstNameStr, lastNameStr, nameSource;
      if (csvFirstName) {
        firstNameStr = csvFirstName;
        lastNameStr = csvLastName || '';
        nameSource = 'CSV';
      } else {
        firstNameStr = contactData.firstName?.toString().trim();
        lastNameStr = contactData.lastName?.toString().trim();
        nameSource = 'Contact Collection';
      }

      const numberStr = contactData.number?.toString().trim()?.replace(/\s+/g, '');
      const genderStr = contactData.gender?.toString().trim().toLowerCase();
      const salutationStr = contactData.salutation?.toString().trim();
      const countryStr = contactData.country?.toString().trim();

      if (!numberStr) {
        rowErrors.push('Phone number is missing in contact data');
      }

      if (!firstNameStr) {
        rowErrors.push('First name is missing in contact data');
      }

      if (genderStr && !VALID_GENDERS.has(genderStr)) {
        rowErrors.push('Gender must be one of: masculine, feminine, neuter, or empty');
      }

      let contactNumber: string | null = null;
      if (numberStr) {
        contactNumber = isValidPhone(numberStr);
        if (!contactNumber) {
          rowErrors.push('Invalid phone number format in contact data');
        } else {
          try {
            if (!validatePhone(contactNumber)) {
              rowErrors.push(`Invalid phone number format in contact data`);
              contactNumber = null;
            } else {
              if (blacklistedNumbers.has(contactNumber)) {
                isBlacklisted = true;
                rowErrors.push('This number is in the Do Not Contact list');
              }
            }
          } catch (error) {
            rowErrors.push('Invalid phone number format in contact data');
            contactNumber = null;
          }
        }
      }

      if (isBlacklisted) {
        processedContacts.push({
          row: rowIndex,
          originalData: csvRow,
          status: 'blacklisted',
          errors: rowErrors
        });
      } else if (rowErrors.length > 0) {
        processedContacts.push({
          row: rowIndex,
          originalData: csvRow,
          status: 'failed',
          errors: rowErrors
        });
      } else if (contactNumber) {
        const validContact: any = {
          number: contactNumber,
          firstName: firstNameStr,
          lastName: lastNameStr,
          email: emailStr,
          gender: (genderStr as any) || null,
          salutation: salutationStr || '',
          country: countryStr || ''
        };

        validatedContacts.push(validContact);
        processedContacts.push({
          row: rowIndex,
          originalData: csvRow,
          validatedData: validContact,
          status: 'success',
          errors: []
        });
      }
    } catch (error: any) {
      processedContacts.push({
        row: rowIndex,
        originalData: csvRow,
        status: 'failed',
        errors: [`Unexpected error: ${error.message}`]
      });
    }
  }

  return { valid: validatedContacts, processed: processedContacts };
}

function generateValidationReport(
  processedContacts: ProcessedContact[],
  originalFileName: string,
  isContactSheet: boolean = false
): Buffer {
  const workbook = XLSX.utils.book_new();

  if (isContactSheet) {
    // Sheet 1: Valid Contacts (from Contact collection)
    const validContacts = processedContacts.filter((c) => c.status === 'success');
    if (validContacts.length > 0) {
      const validData = validContacts.map((pc) => ({
        Row: pc.row,
        Email: pc.validatedData?.email || pc.originalData?.email || '',
        'First Name': pc.validatedData?.firstName || pc.originalData?.first_name || '',
        'Last Name': pc.validatedData?.lastName || pc.originalData?.last_name || '',
        'Phone Number': pc.validatedData?.number || '',
        Gender: pc.validatedData?.gender || '',
        Salutation: pc.validatedData?.salutation || '',
        Country: pc.validatedData?.country || '',
        'Validation Status': 'SUCCESS',
        'Error Messages': 'No errors'
      }));

      const validSheet = XLSX.utils.json_to_sheet(validData);

      // Set column widths
      validSheet['!cols'] = [
        { wch: 6 }, // Row
        { wch: 30 }, // Email
        { wch: 15 }, // First Name
        { wch: 15 }, // Last Name
        { wch: 18 }, // Phone Number
        { wch: 12 }, // Client ID
        { wch: 10 }, // Gender
        { wch: 12 }, // Salutation
        { wch: 15 }, // Country
        { wch: 18 }, // Status
        { wch: 50 } // Error Messages
      ];

      XLSX.utils.book_append_sheet(workbook, validSheet, 'Valid Contacts');
    }

    // Sheet 2: Invalid Contacts (validation errors)
    const invalidContacts = processedContacts.filter((c) => c.status === 'failed');
    if (invalidContacts.length > 0) {
      const invalidData = invalidContacts.map((pc) => ({
        Row: pc.row,
        Email: pc.originalData?.email || '',
        'First Name': pc.originalData?.first_name || '',
        'Last Name': pc.originalData?.last_name || '',
        'Validation Status': 'FAILED',
        'Error Messages': pc.errors.join('; ')
      }));

      const invalidSheet = XLSX.utils.json_to_sheet(invalidData);

      // Set column widths
      invalidSheet['!cols'] = [
        { wch: 6 }, // Row
        { wch: 30 }, // Email
        { wch: 15 }, // First Name
        { wch: 15 }, // Last Name
        { wch: 18 }, // Status
        { wch: 60 } // Error Messages
      ];

      XLSX.utils.book_append_sheet(workbook, invalidSheet, 'Invalid Contacts');
    }

    const blacklistedContacts = processedContacts.filter((c) => c.status === 'blacklisted');
    if (blacklistedContacts.length > 0) {
      const blacklistedData = blacklistedContacts.map((pc) => ({
        Row: pc.row,
        Email: pc.originalData?.email || pc.validatedData?.email || '',
        'First Name': pc.validatedData?.firstName || pc.originalData?.first_name || '',
        'Last Name': pc.validatedData?.lastName || pc.originalData?.last_name || '',
        'Phone Number': pc.validatedData?.number || '',
        'Validation Status': 'BLACKLISTED',
        Reason: 'Number is in Do Not Contact list'
      }));

      const blacklistedSheet = XLSX.utils.json_to_sheet(blacklistedData);

      // Set column widths
      blacklistedSheet['!cols'] = [
        { wch: 6 }, // Row
        { wch: 30 }, // Email
        { wch: 15 }, // First Name
        { wch: 15 }, // Last Name
        { wch: 18 }, // Phone Number
        { wch: 18 }, // Status
        { wch: 50 } // Reason
      ];

      XLSX.utils.book_append_sheet(workbook, blacklistedSheet, 'Blacklisted');
    }

    // Sheet 4: Contact Not Found (specific to Contact Sheet mode)
    const notFoundContacts = processedContacts.filter((c) => c.status === 'contact_not_found');
    if (notFoundContacts.length > 0) {
      const notFoundData = notFoundContacts.map((pc) => ({
        Row: pc.row,
        Email: pc.originalData?.email || '',
        'First Name': pc.originalData?.first_name || '',
        'Last Name': pc.originalData?.last_name || '',
        'Validation Status': 'CONTACT NOT FOUND',
        Reason: pc.errors.join('; ')
      }));

      const notFoundSheet = XLSX.utils.json_to_sheet(notFoundData);

      notFoundSheet['!cols'] = [
        { wch: 6 }, // Row
        { wch: 30 }, // Email
        { wch: 15 }, // First Name
        { wch: 15 }, // Last Name
        { wch: 22 }, // Status
        { wch: 50 } // Reason
      ];

      XLSX.utils.book_append_sheet(workbook, notFoundSheet, 'Contact Not Found');
    }
  } else {
    const reportData = processedContacts.map((pc) => {
      const originalData = pc.originalData;

      let statusText = 'SUCCESS';
      if (pc.status === 'blacklisted') {
        statusText = 'BLACKLISTED';
      } else if (pc.status === 'failed') {
        statusText = 'FAILED';
      }

      return {
        phone_number: originalData.phone_number || '',
        salutation: originalData.salutation || '',
        first_name: originalData.first_name || '',
        last_name: originalData.last_name || '',
        gender: originalData.gender || '',
        email: originalData.email || '',
        country: originalData.country || '',
        'Validation Status': statusText,
        'Error Messages': pc.errors.length > 0 ? pc.errors.join('; ') : 'No errors'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(reportData);

    worksheet['!cols'] = [
      { wch: 12 },
      { wch: 18 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 10 },
      { wch: 25 },
      { wch: 15 },
      { wch: 18 },
      { wch: 60 }
    ];

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddress]) continue;

      worksheet[cellAddress].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4472C4' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }

    for (let row = 1; row <= range.e.r; row++) {
      const statusCell = XLSX.utils.encode_cell({ r: row, c: 8 });
      const errorCell = XLSX.utils.encode_cell({ r: row, c: 9 });

      if (worksheet[statusCell]) {
        const status = worksheet[statusCell].v;

        let fontColor = '006100';
        let bgColor = 'C6EFCE';

        if (status === 'BLACKLISTED') {
          fontColor = 'FF6600';
          bgColor = 'FFE5CC';
        } else if (status === 'FAILED') {
          fontColor = 'C00000';
          bgColor = 'FFC7CE';
        }

        worksheet[statusCell].s = {
          font: { bold: true, color: { rgb: fontColor } },
          fill: { fgColor: { rgb: bgColor } },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }

      if (worksheet[errorCell]) {
        worksheet[errorCell].s = {
          alignment: { horizontal: 'left', vertical: 'center', wrapText: true }
        };
      }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Validation Report');
  }

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

// Validate batch call payload
function validateBatchCallPayload(formData: any, isContactSheet: boolean = false) {
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
        errors.push('Status must be 1 (DRAFT) or 9 (CREATED FOR CALLING)');
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
      followUpsDetails:
        Array.isArray(formData?.followUpsDetails) && formData?.followUpsDetails.length > 0
          ? formData?.followUpsDetails
          : [],
      isContactSheet: isContactSheet,
      phoneNumberId: formData.phoneNumberId?.trim() || undefined,
    };
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Failed to parse file', error.message);
  }
}

// Enhanced parse and validate function
async function parseAndValidateFile(
  filePath: string,
  fileName: string,
  companyId: any,
  isContactSheet: boolean = false,
  userId?: string
): Promise<{
  validContacts: Contact[];
  allProcessedContacts: ProcessedContact[];
  reportBuffer: Buffer;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    blacklisted: number;
    contactNotFound?: number;
  };
}> {
  try {
    const contacts = await parseFile(filePath);
    if (!Array.isArray(contacts) || contacts.length === 0) {
      throw new ValidationError('File contains no valid contacts');
    }

    console.log(`Processing ${contacts.length} contacts...`);

    // Validate file structure
    const firstContact = contacts[0];
    console.log('First contact data for structure validation:', firstContact);
    const availableKeys = Object.keys(firstContact).map((key) =>
      key
        .replace(/^\uFEFF/, '')
        .trim()
        .toLowerCase()
    );

    console.log('Available columns in file:', availableKeys);

    // ✅ CONDITIONAL VALIDATION BASED ON MODE
    if (isContactSheet) {
      const requiredKeys = REQUIRED_CONTACT_SHEET_COLUMNS.map((col) => col.toLowerCase());
      const missingColumns = requiredKeys.filter((col) => !availableKeys.includes(col));

      if (missingColumns.length > 0) {
        throw new ValidationError(
          `Missing required columns for Contact Sheet mode: ${missingColumns.join(', ')}. Required columns are: ${REQUIRED_CONTACT_SHEET_COLUMNS.join(', ')}. Available columns: ${availableKeys.join(', ')}`
        );
      }
    } else {
      const requiredKeys = REQUIRED_CSV_COLUMNS.map((col) => col.toLowerCase());
      const missingColumns = requiredKeys.filter((col) => !availableKeys.includes(col));

      if (missingColumns.length > 0) {
        throw new ValidationError(
          `Missing required columns: ${missingColumns.join(', ')}. Required columns are: ${REQUIRED_CSV_COLUMNS.join(', ')}. Available columns: ${availableKeys.join(', ')}`
        );
      }
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

    console.log('Checking blacklisted numbers...');
    const blacklistedNumbers = await checkBlacklistedNumbers(normalizedContacts, companyId);

    // Process in batches
    const validatedContacts: Contact[] = [];
    const allProcessedContacts: ProcessedContact[] = [];
    const globalNumberSet = new Set<string>();
    const globalBmbyIdSet = new Set<number>();
    let blacklistedCount = 0;
    let contactNotFoundCount = 0;

    for (let i = 0; i < normalizedContacts.length; i += BATCH_SIZE) {
      const batch = normalizedContacts.slice(i, i + BATCH_SIZE);

      let valid, processed;
      if (isContactSheet) {
        if (!userId) {
          throw new ValidationError('User ID is required for Contact Sheet mode');
        }
        const result = await validateContactSheetBatch(batch, i, blacklistedNumbers, userId);
        valid = result.valid;
        processed = result.processed;
        contactNotFoundCount += processed.filter((p) => p.status === 'contact_not_found').length;
      } else {
        const result = validateContactsBatch(batch, i, blacklistedNumbers);
        valid = result.valid;
        processed = result.processed;
      }

      for (const processedContact of processed) {
        if (processedContact.status === 'success' && processedContact.validatedData) {
          const contact = processedContact.validatedData;
          const isDuplicateNumber = globalNumberSet.has(contact.number);

          if (isDuplicateNumber) {
            const errors = [];
            if (isDuplicateNumber)
              errors.push(`Duplicate Phone Number '${contact.number}' found across file`);

            processedContact.status = 'failed';
            processedContact.errors = errors;
            allProcessedContacts.push(processedContact);
          } else {
            globalNumberSet.add(contact.number);
            validatedContacts.push(contact);
            allProcessedContacts.push(processedContact);
          }
        } else {
          if (processedContact.status === 'blacklisted') {
            blacklistedCount++;
          }
          allProcessedContacts.push(processedContact);
        }
      }

      // Allow event loop to process other requests
      if (i + BATCH_SIZE < normalizedContacts.length) {
        await new Promise((resolve) => setImmediate(resolve));
      }

      // Log progress for large files
      if (normalizedContacts.length > 10000 && (i + BATCH_SIZE) % 10000 === 0) {
        console.log(`Processed ${i + BATCH_SIZE}/${normalizedContacts.length} contacts`);
      }
    }

    // Generate validation report
    const reportBuffer = generateValidationReport(allProcessedContacts, fileName, isContactSheet);

    console.log(
      `Successfully validated ${validatedContacts.length} contacts, ${allProcessedContacts.length - validatedContacts.length} invalid (${blacklistedCount} blacklisted)`
    );

    return {
      validContacts: validatedContacts,
      allProcessedContacts: allProcessedContacts,
      reportBuffer: reportBuffer,
      summary: {
        total: contacts.length,
        valid: validatedContacts.length,
        invalid: allProcessedContacts.length - validatedContacts.length,
        blacklisted: blacklistedCount,
        contactNotFound: contactNotFoundCount
      }
    };
  } catch (error: any) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Failed to parse file', error.message);
  }
}

function checkFollowUpsDetails(payload: any, errors: any, fromStartCall: boolean) {
  const validatedMoments: any = [];

  if (!payload.timezone?.trim()) {
    errors.push('Timezone is required');
  }

  if (
    !payload.followUpsDetails ||
    !Array.isArray(payload.followUpsDetails) ||
    payload.followUpsDetails.length === 0
  ) {
    errors.push('At least one follow-up detail is required');
  } else {
    for (let i = 0; i < payload.followUpsDetails.length; i++) {
      const detail = payload.followUpsDetails[i];
      const rowIndex = i + 1;

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!detail.date?.trim()) {
        errors.push(`Row ${rowIndex}: Date is required`);
        continue;
      }
      if (!dateRegex.test(detail.date.trim())) {
        errors.push(`Row ${rowIndex}: Date must be in YYYY-MM-DD format`);
        continue;
      }

      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!detail.time?.trim()) {
        errors.push(`Row ${rowIndex}: Time is required`);
        continue;
      }
      if (!timeRegex.test(detail.time.trim())) {
        errors.push(`Row ${rowIndex}: Time must be in HH:MM format (24-hour)`);
        continue;
      }

      try {
        const dateTimeString = `${detail.date.trim()}T${detail.time.trim()}`;
        const scheduledMoment = moment.tz(dateTimeString, payload.timezone);

        if (!scheduledMoment.isValid()) {
          errors.push(`Row ${rowIndex}: Invalid date/time combination`);
          continue;
        }

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

    if (validatedMoments.length > 1) {
      const sortedMoments = [...validatedMoments].sort((a, b) => a.valueOf() - b.valueOf());

      for (let i = 1; i < sortedMoments.length; i++) {
        const previousMoment = sortedMoments[i - 1];
        const currentMoment = sortedMoments[i];
        const difference = currentMoment.diff(
          previousMoment,
          BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN,
          true
        );

        if (difference < BATCH_CALL_FOLLOWUPS_DIFF.DIFF_VALUE) {
          const originalIndex1 =
            validatedMoments.findIndex(
              (m: { valueOf: () => any }) => m.valueOf() === previousMoment.valueOf()
            ) + 1;
          const originalIndex2 =
            validatedMoments.findIndex(
              (m: { valueOf: () => any }) => m.valueOf() === currentMoment.valueOf()
            ) + 1;
          errors.push(
            `Follow-up calls must have at least ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_VALUE} ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN} difference (Row ${originalIndex1} and Row ${originalIndex2} are ${difference.toFixed(1)} ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN} apart)`
          );
        }
      }
    }

    const dateTimeStrings = new Set();
    payload.followUpsDetails.forEach((detail: { date: string; time: string }, index: number) => {
      if (detail.date?.trim() && detail.time?.trim()) {
        const dateTimeKey = `${detail.date.trim()}_${detail.time.trim()}`;
        if (dateTimeStrings.has(dateTimeKey)) {
          errors.push(`Row ${index + 1}: Duplicate date/time combination found`);
        }
        dateTimeStrings.add(dateTimeKey);
      }
    });
  }

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
      originalBatchMoment = now;
    }
  }

  if (originalBatchMoment && validatedMoments.length > 0) {
    const sortedMoments = [...validatedMoments].sort((a, b) => a.valueOf() - b.valueOf());
    const firstFollowUpMoment = sortedMoments[0];
    const difference = firstFollowUpMoment.diff(
      originalBatchMoment,
      BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN,
      true
    );
    if (difference < BATCH_CALL_FOLLOWUPS_DIFF.DIFF_VALUE) {
      const originalIndex =
        validatedMoments.findIndex(
          (m: { valueOf: () => any }) => m.valueOf() === firstFollowUpMoment.valueOf()
        ) + 1;
      errors.push(
        `First follow-up call must have at least ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_VALUE} ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN} difference from original batch call (currently ${difference.toFixed(1)} ${BATCH_CALL_FOLLOWUPS_DIFF.DIFF_IN} apart - Row ${originalIndex})`
      );
    }
  }
  return errors;
}

async function checkBlacklistedNumbers(contacts: any[], companyId: any): Promise<Set<string>> {
  try {
    const db = BlackList.db; // or use your existing db connection
    const blackListCollection = db.collection('BlackList');

    // Extract all phone numbers from contacts
    const phoneNumbers = contacts
      .map((c) => c.phone_number?.toString().trim())
      .filter(Boolean)
      .map((num) => (!num.startsWith('+') ? '+' + num : num));

    if (phoneNumbers.length === 0) {
      return new Set();
    }

    // Query blacklist for these numbers with the specific companyId
    const blacklistedRecords = await blackListCollection
      .find({
        toNumber: { $in: phoneNumbers },
        companyId: companyId,
        isArchived: false
      })
      .project({ toNumber: 1 })
      .toArray();

    // Return Set of blacklisted numbers
    const blacklistedNumbers = new Set(blacklistedRecords.map((record: any) => record.toNumber));

    console.log(`Found ${blacklistedNumbers.size} blacklisted numbers for company ${companyId}`);
    return blacklistedNumbers;
  } catch (error) {
    console.error('Error checking blacklist:', error);
    return new Set(); // Return empty set on error to not block the process
  }
}


export async function createBatchCallPM(request: any, reply: any) {
  let filePath: string | null = null;
  let fileName: string = 'uploaded_file';

  try {
    const user = request.user;
    if (!user) {
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
        fileName = part.filename;
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

    const isContactSheet = formData.isContactSheet === 'true' || formData.isContactSheet === true;
    console.log('✓ isContactSheet mode:', isContactSheet);

    const validatedPayload = validateBatchCallPayload(formData, isContactSheet);
    // Parse and validate file - now returns report buffer
    const { validContacts, allProcessedContacts, reportBuffer, summary } =
      await parseAndValidateFile(filePath, fileName, user.companyId, isContactSheet, user.userId);


    const recipientsForDb = validContacts.map((contact) => ({
      ...contact,
    }));

    console.log('recipientsForDb', recipientsForDb);

    if (allProcessedContacts.length === 0) {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return reply.status(400).send({
        success: false,
        error: 'No Contacts Found',
        message: 'The uploaded file contains no contacts',
        details: []
      });
    }

    const db = Agent.db;
    const agentCollection = db.collection('Agent');

    const agent = await agentCollection.findOne(
      {
        companyId: user.companyId,
        agentId: validatedPayload.agentId,
        isArchived: false
      },
      {
        projection: {
          _id: 1,
          agentId: 1,
          agentName: 1,
          voiceProvider: 1,
          primaryPhone: 1,
          vapiPhoneNumberId: 1,
          assistantId: 1,
          retellPhoneNumberId: 1
        }
      }
    );

    if (!agent) {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return reply.status(404).send({
        success: false,
        error: 'Agent Not Found',
        message: 'No agent found with the provided agentId',
        details: { agentId: validatedPayload.agentId }
      });
    }

    const agentVoiceProvider = agent.voiceProvider?.toLowerCase();

    if (!agentVoiceProvider) {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return reply.status(400).send({
        success: false,
        error: 'Configuration Error',
        message: 'Agent does not have a voice provider configured',
        details: { agentId: agent.agentId }
      });
    }

    const company: any = await Company.findOne({ _id: user.companyId }).lean();

    if (!company) {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return reply.status(400).send({
        success: false,
        error: 'Company Not Found',
        message: 'Company configuration not found',
        details: []
      });
    }
    let companyVoiceProviders: string[] = [];
    let apiKeyId: string | null = null;

    if (company.voiceProviders && Array.isArray(company.voiceProviders)) {
      companyVoiceProviders = company.voiceProviders
        .map((vp: any) => vp.name?.toLowerCase())
        .filter((name: string) => name);
      const matchingProvider = company.voiceProviders.find(
        (vp: any) => vp.name?.toLowerCase() === agentVoiceProvider
      );

      if (matchingProvider) {
        apiKeyId = matchingProvider.api_key_id;
      }
    }

    if (!companyVoiceProviders.includes(agentVoiceProvider)) {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return reply.status(400).send({
        success: false,
        error: 'Voice Provider Mismatch',
        message: `Agent's voice provider (${agentVoiceProvider}) is not enabled for this company`,
        details: {
          agentProvider: agentVoiceProvider,
          companyProviders: companyVoiceProviders
        }
      });
    }
    if (!apiKeyId || apiKeyId.trim() === '') {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return reply.status(400).send({
        success: false,
        error: 'API Key Not Configured',
        message: `No valid API key found for ${agentVoiceProvider.toUpperCase()} voice provider`,
        details: {
          voiceProvider: agentVoiceProvider
        }
      });
    }
    const userAgent: any = await UserAgent.findOne({
      userId: user.userId,
      agentId: agent._id,
      companyId: user.companyId,
      isArchived: false
    });

    if (!userAgent) {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return reply.status(403).send({
        success: false,
        error: 'Access Denied',
        message: 'User does not have access to this agent',
        details: {
          userId: user.userId,
          requestedAgentId: agent.agentId
        }
      });
    }

    let assistantId = null;
    let vapiPhoneNumberId = null;
    let retellPhoneNumberId = null;
    if (agentVoiceProvider === 'vapi') {
      // const isVapiPhoneNumberIdInvalid =
      //   !agent.vapiPhoneNumberId || agent.vapiPhoneNumberId.trim() === '';

      // const isAssistantIdInvalid = !agent.assistantId || agent.assistantId.trim() === '';

      // if (isVapiPhoneNumberIdInvalid || isAssistantIdInvalid) {
      //   if (filePath && fs.existsSync(filePath)) {
      //     fs.unlinkSync(filePath);
      //   }

      //   const missingFields = [];
      //   if (isVapiPhoneNumberIdInvalid) missingFields.push('VAPI Phone Number ID');
      //   if (isAssistantIdInvalid) missingFields.push('Assistant ID');

      //   return reply.status(400).send({
      //     success: false,
      //     error: 'Incomplete Agent Profile',
      //     message: `VAPI provider requires additional configuration. Missing: ${missingFields.join(', ')}`,
      //     details: {
      //       agentName: agent.agentName || 'Unknown Agent',
      //       voiceProvider: agentVoiceProvider,
      //       missingFields: missingFields
      //     }
      //   });
      // }

      assistantId = validatedPayload.agentId;
      vapiPhoneNumberId = validatedPayload.phoneNumberId;

      console.log('✓ VAPI configuration:', {
        assistantId,
        vapiPhoneNumberId
      });
    } else if (agentVoiceProvider === 'retell') {
      assistantId = agent.agentId;
      retellPhoneNumberId = agent.retellPhoneNumberId;

      console.log('✓ Retell configuration:', {
        assistantId,
        retellPhoneNumberId: retellPhoneNumberId || 'Not configured'
      });
    } else {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return reply.status(400).send({
        success: false,
        error: 'Unsupported Voice Provider',
        message: `Unsupported voice provider: ${agentVoiceProvider}`,
        details: []
      });
    }

    const { agentId: _, ...payloadWithoutAgentId } = validatedPayload;

    const batchCallPayload: any = {
      ...payloadWithoutAgentId,
      recipients: recipientsForDb,
      assistantId: assistantId,
      voiceProvider: agentVoiceProvider,
      agentMongoId: agent._id,
      isContactSheet: validatedPayload.isContactSheet
    };

    if (agentVoiceProvider === 'retell' && retellPhoneNumberId) {
      batchCallPayload.retellPhoneNumberId = retellPhoneNumberId;
    }
    batchCallPayload.phoneNumberId = validatedPayload.phoneNumberId;
    if (recipientsForDb.length === 0) {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupError) {
          Server.log.error(cleanupError, 'Error cleaning up uploaded file');
        }
      }
      return reply.send({
        success: true,
        data: null,
        message: `Batch call not created as there are no valid contacts to call.`,
        summary: {
          total: summary.total,
          valid: summary.valid,
          invalid: summary.invalid,
          blacklisted: summary.blacklisted,
          successRate: ((summary.valid / summary.total) * 100).toFixed(2) + '%'
        },
        validationReport: {
          fileName: `validation_report_${Date.now()}.xlsx`,
          buffer: reportBuffer.toString('base64'),
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          note: 'Download this file to see validation status and error details for each contact'
        }
      });
    }
    const result: any = await batchCallService.create(request.user, batchCallPayload);
    // Cleanup
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        Server.log.error(cleanupError, 'Error cleaning up uploaded file');
      }
    }

    // Clear cache periodically
    if (phoneValidationCache.size > MAX_CACHE_SIZE * 0.8) {
      phoneValidationCache.clear();
    }

    // Prepare response with Excel report
    const hasInvalidContacts = summary.invalid > 0;

    return reply.send({
      success: true,
      data: result,
      message:
        validContacts.length === 0
          ? `Batch call created but all ${summary.total} contacts were invalid (${summary.blacklisted} blacklisted, ${summary.invalid - summary.blacklisted} other errors). No calls will be made.`
          : summary.invalid > 0
            ? `Batch call created with ${validContacts.length} valid contacts. ${summary.invalid} contacts excluded (${summary.blacklisted} blacklisted, ${summary.invalid - summary.blacklisted} other errors).`
            : `Batch call created successfully with ${validContacts.length} contacts`,
      summary: {
        total: summary.total,
        valid: summary.valid,
        invalid: summary.invalid,
        blacklisted: summary.blacklisted,
        successRate: ((summary.valid / summary.total) * 100).toFixed(2) + '%'
      },
      validationReport: {
        fileName: `validation_report_${result.batchCallId || Date.now()}.xlsx`,
        buffer: reportBuffer.toString('base64'),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        note: 'Download this file to see validation status and error details for each contact'
      }
    });
  } catch (error: any) {
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
          'Ensure your CSV has columns: salutation, first_name, last_name, email, client_id, phone_number, gender, country',
          'Phone numbers should include country code (+49xxxxxxxxxx)',
          'Gender should be: masculine, feminine, neuter',
          'Remove empty rows and duplicate phone numbers'
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
