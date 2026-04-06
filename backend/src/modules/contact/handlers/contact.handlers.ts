import { FastifyRequest, FastifyReply } from 'fastify';
import { ContactService } from '../services/contact.services';
import { throwError } from '../../../common/app-helper';
import { Server } from '../../../server';
import * as fs from 'fs';
import * as path from 'path';
import parseFile, { validatePhoneWithError } from '../../batchCall/helpers/helper';

const ContactServiceInstance = new ContactService();

interface QueryParams {
  skip?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  isActive?: boolean;
}

export async function uploadContactsHandler(request: any, reply: FastifyReply) {
  let uploadedFilePath: string | null = null;

  try {
    Server.log.info('📤 Upload Contacts request received');

    const user = request.user as any;

    // Validate user is authenticated
    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    Server.log.info({
      userId: user?.userId || user?._id,
      companyId: user?.companyId
    }, '👤 User authenticated');

    // Get uploaded file
    const data = await request.file();

    if (!data) {
      Server.log.error('No file in request');
      throw throwError('No file uploaded', { status: 400 }, 'BAD_REQUEST');
    }

    const { filename, file } = data;
    const ext = path.extname(filename).toLowerCase();

    Server.log.info({ filename, extension: ext }, '📁 File received');

    // Validate file type - EXCEL ONLY (matching frontend)
    if (!['.xlsx', '.xls'].includes(ext)) {
      Server.log.error({ filename, extension: ext }, '❌ Invalid file type');
      throw throwError(
        'Invalid file format. Only Excel files (.xlsx, .xls) are supported',
        { status: 400 },
        'INVALID_FILE_FORMAT'
      );
    }

    // Save file temporarily
    const uploadDir = path.join(__dirname, '../../../../uploads/contacts');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      Server.log.info({ uploadDir }, '📁 Created upload directory');
    }

    const timestamp = Date.now();
    const tempFileName = `${timestamp}_${filename}`;
    uploadedFilePath = path.join(uploadDir, tempFileName);

    // Write file to disk
    const writeStream = fs.createWriteStream(uploadedFilePath);
    await new Promise<void>((resolve, reject) => {
      file.pipe(writeStream);
      writeStream.on('finish', () => resolve());
      writeStream.on('error', (err) => reject(err));
    });

    Server.log.info({ filePath: uploadedFilePath }, '✅ File saved to disk');

    // Parse the file
    Server.log.info({ filePath: uploadedFilePath }, '🔄 Parsing Excel file...');
    const parsedContacts = await parseFile(uploadedFilePath);

    if (!parsedContacts || parsedContacts.length === 0) {
      Server.log.error('No contacts found in file after parsing');
      throw throwError(
        'No valid contacts found in the uploaded file',
        { status: 400 },
        'EMPTY_FILE'
      );
    }

    Server.log.info({ count: parsedContacts.length }, '✅ Contacts parsed from file');

    // Process and validate contacts
    const result = await ContactServiceInstance.bulkUploadContacts(
      user,
      parsedContacts
    );

    // Clean up uploaded file
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
      Server.log.info({ filePath: uploadedFilePath }, '🗑️  Temporary file cleaned up');
    }

    Server.log.info(result, '✅ Upload Contacts completed successfully');
    return result;

  } catch (error: any) {
    Server.log.error(error, '❌ Error in uploadContactsHandler');

    // Clean up uploaded file on error
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
        Server.log.info({ filePath: uploadedFilePath }, '🗑️  Temporary file cleaned up after error');
      } catch (cleanupError) {
        Server.log.error(cleanupError, '❌ Error cleaning up uploaded file');
      }
    }

    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to upload contacts'
    });
  }
}


export async function createContactHandler(request: any, reply: FastifyReply) {
  try {
    Server.log.info(request.body, 'Create Contact request payload');

    const user = request.user as any;

    // Validate user is authenticated
    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    const result = await ContactServiceInstance.contactCreate(request.user, request.body);
    Server.log.info(result, 'Create Contact response payload');

    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in createContactHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to create contact'
    });
  }
}

export async function getContactListHandler(
  request: FastifyRequest<{ Querystring: QueryParams }>,
  reply: FastifyReply
) {
  try {
    Server.log.info(request.query, 'Get Contact List request');

    const user = request.user as any;

    // Validate user is authenticated
    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    const result = await ContactServiceInstance.getContactList(request.user, request.query);

    Server.log.info(result, 'Get Contact List response');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in getContactListHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to fetch contacts'
    });
  }
}

export async function updateContactHandler(request: any, reply: FastifyReply) {
  try {
    Server.log.info(request.body, 'Update Contact request payload');

    const user = request.user as any;

    // Validate user is authenticated
    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    const result = await ContactServiceInstance.updateContact(request.user, request.body);
    Server.log.info(result, 'Update Contact response payload');

    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in updateContactHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to update contact'
    });
  }
}

export async function deleteContactHandler(request: any, reply: FastifyReply) {
  try {
    Server.log.info(request.body, 'Delete Contact request payload');

    const user = request.user as any;

    // Validate user is authenticated
    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    const result = await ContactServiceInstance.deleteContact(request.user, request.body);
    Server.log.info(result, 'Delete Contact response payload');

    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in deleteContactHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to delete contact'
    });
  }
}


export async function exportContactListHandler(
  request: FastifyRequest<{ Querystring: QueryParams }>,
  reply: FastifyReply
) {
  try {
    Server.log.info(request.query, 'Get Contact List request');
    const user = request.user as any;
    if (!user) {
      throw throwError('Authentication required', { status: 401 }, 'UNAUTHORIZED');
    }

    const result = await ContactServiceInstance.exportListing(request.user, request.query);
    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', 'attachment; filename="contact_export.xlsx"')
      .send(result);
  } catch (error: any) {
    Server.log.error(error, 'Error in getContactListHandler');
    return reply.code(error?.status || 500).send({
      success: false,
      message: error?.message || 'Failed to fetch contacts'
    });
  }
}