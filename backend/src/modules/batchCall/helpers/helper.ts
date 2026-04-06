import * as fs from 'fs';
import * as csv from 'fast-csv';
import * as xlsx from 'xlsx';
import * as path from 'path';
import { parsePhoneNumberFromString, parsePhoneNumberWithError } from "libphonenumber-js/max";


export default function parseFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') return parseCSV(filePath);
  if (ext === '.xlsx' || ext === '.xls') return parseXLSX(filePath);
  throw new Error('Unsupported file format');
}

function parseCSV(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const contacts: any[] = [];

    // First, try to detect delimiter by reading first line
    const firstLine = fs.readFileSync(filePath, 'utf8').split('\n')[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';

    fs.createReadStream(filePath)
      .pipe(
        csv.parse({
          headers: true,
          delimiter: delimiter,
          ignoreEmpty: true,
          trim: true
        })
      )
      .on('error', reject)
      .on('data', (row) => {
        const normalizedRow = normalizeRow(row);
        if (normalizedRow.phone_number || normalizedRow.first_name) {
          // Only add if we have essential data
          contacts.push(normalizedRow);
        }
      })
      .on('end', () => resolve(contacts));
  });
}

function parseXLSX(filePath: string): any[] {
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  return data.map(normalizeRow).filter((row) => row.phone_number || row.client_id || row.email);
}

function normalizeRow(row: any) {
  // Handle the case where the entire header might be a single key with tabs
  const keys = Object.keys(row);
  if (keys.length === 1 && keys[0].includes('\t')) {
    // Split the tab-separated header and values
    const headerKey = keys[0];
    const headerParts = headerKey.split('\t');
    const valueString = row[headerKey]?.toString();
    const valueParts = valueString.split('\t');

    const normalizedRow: any = {};
    headerParts.forEach((header, index) => {
      const cleanHeader = header.trim();
      const value = valueParts[index]?.trim();
      normalizedRow[cleanHeader] = value;
    });

    return {
      phone_number: normalizedRow.phone_number,
      salutation: normalizedRow.salutation,
      gender: normalizedRow.gender,
      first_name: normalizedRow.first_name,
      last_name: normalizedRow.last_name,
      email: normalizedRow.email,
      client_id: normalizedRow.client_id,
      country: normalizedRow.country
    };
  }

  // Helper function to get field value and clean it
  const getField = (fieldNames: string[]) => {
    for (const name of fieldNames) {
      if (row[name] !== undefined && row[name] !== null) {
        const value = row[name].toString().trim();
        // Check for empty values, quoted empty strings, or just whitespace
        if (value !== '' && value !== "''" && value !== '""' && value !== 'null' && value !== 'undefined') {
          return value;
        }
      }
    }
    return null; // Return null for truly empty values
  };

  return {
    phone_number: getField(['phone_number']),
    gender: getField(['gender']),
    first_name: getField(['first_name']),
    salutation: getField(['salutation']),
    last_name: getField(['last_name']),
    email: getField(['email']),
    client_id: getField(['client_id']),
    country: getField(['country'])
  };
}



export function validatePhone(num: string) {
  try {
    const phone = parsePhoneNumberFromString(num);
    return phone?.isValid() && phone?.isPossible();
  } catch {
    return false;
  }
}

export function validatePhoneWithError(number: string) {
  try {
    const phone = parsePhoneNumberWithError(number);

    if (!phone.isValid()) {
      return { valid: false, error: "Invalid phone number format" };
    }

    return { valid: true };
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}
