import { Contact } from '../models/contact.model';
import { throwError } from '../../../common/app-helper';
import { Types } from 'mongoose';
import * as XLSX from 'xlsx';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { Server } from '../../../server';
import { toTitleCaseWithSpaces } from '../../../common/format-helper';

export class ContactService {
  private extractFirstNameFromEmail(firstName: string | null | undefined, email: string): string {
    const isFirstNameBlank = !firstName || firstName.trim() === '';

    if (isFirstNameBlank && email) {
      const emailPrefix = email.split('@')[0];
      Server.log.info(
        {
          email,
          extractedFirstName: emailPrefix
        },
        '🔧 firstName is blank - extracted from email'
      );
      return emailPrefix;
    }

    return firstName ? firstName.trim() : '';
  }

  async contactCreate(user: any, body: any) {
    try {
      const { companyId, userId, _id } = user;
      const currentUserId = userId || _id;

      if (!body.email || !body.email.trim()) {
        throw throwError('Email is required', { status: 400 }, 'MISSING_EMAIL');
      }

      if (!body.number || !body.number.trim()) {
        throw throwError('Phone number is required', { status: 400 }, 'MISSING_PHONE');
      }

      if (body.bmbyId === null || body.bmbyId === undefined) {
        throw throwError('Client ID (bmbyId) is required', { status: 400 }, 'MISSING_CLIENT_ID');
      }

      // ✅ Extract firstName from email if blank
      const firstName = this.extractFirstNameFromEmail(body.firstName, body.email);

      if (!firstName) {
        throw throwError(
          'First name could not be determined from email',
          { status: 400 },
          'INVALID_FIRST_NAME'
        );
      }

      const existingContactByEmail = await Contact.findOne({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(currentUserId),
        email: body.email.trim().toLowerCase(),
        isArchived: false
      });

      if (existingContactByEmail) {
        throw throwError(
          'Contact with this email already exists',
          { status: 409 },
          'DUPLICATE_EMAIL'
        );
      }

      const existingContactByPhone = await Contact.findOne({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(currentUserId),
        number: body.number.trim(),
        isArchived: false
      });

      if (existingContactByPhone) {
        throw throwError(
          'Contact with this phone number already exists',
          { status: 409 },
          'DUPLICATE_PHONE'
        );
      }

      const existingContactByBmbyId = await Contact.findOne({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(currentUserId),
        bmbyId: body.bmbyId,
        isArchived: false
      });

      if (existingContactByBmbyId) {
        throw throwError(
          'Contact with this client ID already exists',
          { status: 409 },
          'DUPLICATE_CLIENT_ID'
        );
      }

      Server.log.info(
        {
          userId: currentUserId,
          email: body.email,
          number: body.number,
          firstName,
          bmbyId: body.bmbyId
        },
        '✅ Validation passed - creating contact'
      );

      const newContact = new Contact({
        ...body,
        firstName,
        lastName: body.lastName ? body.lastName.trim() : '', // Optional
        email: body.email.trim().toLowerCase(),
        number: body.number.trim(),
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(currentUserId)
      });

      await newContact.save();

      Server.log.info(
        {
          contactId: newContact._id,
          createdBy: currentUserId,
          firstName: newContact.firstName
        },
        '✅ Contact created successfully'
      );

      return {
        success: true,
        message: 'Contact created successfully',
        data: newContact
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Get contact list with pagination and search
   */
  async getContactList(user: any, query: any) {
    try {
      const { companyId, isHSAdmin, userId: authUserId, _id, isAdmin: userIsAdmin } = user;
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;

      const {
        skip = 0,
        limit = 10,
        searchStr = '',
        sortBy = 'createdAt desc',
        isActive,
        userId: requestedUserId
      } = query;

      let filter: any = { isArchived: false };

      const isAdmin = isHSAdmin || userIsAdmin || companyId?.toString() === SUPER_ADMIN_COMPANY_ID;
      const currentUserId = authUserId || _id;

      Server.log.info(
        {
          isHSAdmin,
          userIsAdmin,
          isAdmin,
          currentUserId,
          requestedUserId
        },
        '🔍 Admin check details'
      );

      if (isAdmin) {
        const targetUserId = requestedUserId || currentUserId;
        filter.createdBy = new Types.ObjectId(targetUserId);

        Server.log.info(
          {
            adminId: currentUserId,
            viewingUserId: targetUserId
          },
          '🔐 Admin viewing contacts filtered by userId'
        );

        if (!isHSAdmin || companyId?.toString() !== SUPER_ADMIN_COMPANY_ID) {
          filter.companyId = new Types.ObjectId(companyId);
        }
      } else {
        filter.createdBy = new Types.ObjectId(currentUserId);
        filter.companyId = new Types.ObjectId(companyId);

        Server.log.info(
          {
            userId: currentUserId
          },
          '🔐 Regular user viewing own contacts only'
        );

        if (requestedUserId && requestedUserId !== currentUserId.toString()) {
          Server.log.warn(
            {
              userId: currentUserId,
              attemptedUserId: requestedUserId
            },
            '⚠️  Regular user attempted to access other user contacts - blocked'
          );
        }
      }

      if (typeof isActive === 'boolean') {
        filter.isActive = isActive;
      }

      if (searchStr && searchStr.trim()) {
        const searchTerm = searchStr.trim();
        filter.$or = [
          { firstName: { $regex: searchTerm, $options: 'i' } },
          { lastName: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } },
          { number: { $regex: searchTerm, $options: 'i' } }
        ];
      }

      const sort: any = {};

      if (sortBy) {
        const sortParts = sortBy.trim().split(' ');
        const sortField = sortParts[0];
        const sortDirection = sortParts[1]?.toLowerCase();

        let direction = -1;
        if (sortDirection === 'asc') {
          direction = 1;
        } else if (sortDirection === 'desc') {
          direction = -1;
        }

        sort[sortField] = direction;
      } else {
        sort.createdAt = -1;
      }

      Server.log.info({ filter, sort, skip, limit }, '🔍 Executing contact list query');

      const [contacts, total] = await Promise.all([
        Contact.find(filter)
          .populate('companyId', 'name')
          .populate('createdBy', 'firstName lastName email')
          .collation({ locale: 'en', strength: 2 })
          .sort(sort)
          .skip(Number(skip))
          .limit(Number(limit))
          .lean(),
        Contact.countDocuments(filter)
      ]);

      Server.log.info(
        {
          contactsFound: contacts.length,
          total
        },
        '✅ Contact list retrieved'
      );

      return {
        success: true,
        message: 'Contacts retrieved successfully',
        data: {
          contacts,
          total,
          skip: Number(skip),
          limit: Number(limit)
        }
      };
    } catch (error: any) {
      Server.log.error(error, '❌ Error in getContactList');
      throw error;
    }
  }

  /**
   * Update contact information
   */
  async updateContact(user: any, body: any) {
    try {
      const { companyId, isHSAdmin, userId, _id, isAdmin: userIsAdmin } = user;
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const currentUserId = userId || _id;

      if (!body._id) {
        throw throwError('Contact ID is required', { status: 400 }, 'MISSING_CONTACT_ID');
      }

      const contact = await Contact.findOne({
        _id: new Types.ObjectId(body._id),
        isArchived: false
      });

      if (!contact) {
        throw throwError('Contact not found', { status: 404 }, 'CONTACT_NOT_FOUND');
      }

      const isAdmin = isHSAdmin || userIsAdmin || companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      if (!isAdmin && contact.createdBy.toString() !== currentUserId.toString()) {
        throw throwError('You can only update your own contacts', { status: 403 }, 'FORBIDDEN');
      }

      Server.log.info(
        {
          contactId: body._id,
          currentUserId,
          contactCreatedBy: contact.createdBy,
          isAdmin
        },
        '🔐 Access check passed'
      );

      const updateData: any = {};

      // ✅ Handle firstName - extract from email if blank
      if (body.hasOwnProperty('firstName') || body.hasOwnProperty('email')) {
        const emailToUse = body.email || contact.email;
        const firstName = this.extractFirstNameFromEmail(body.firstName, emailToUse);
        if (firstName) {
          updateData.firstName = firstName;
        }
      }

      if (body.hasOwnProperty('lastName')) {
        updateData.lastName = body.lastName ? body.lastName.trim() : '';
      }
      if (body.email) {
        updateData.email = body.email.trim().toLowerCase();
      }
      if (body.number) {
        updateData.number = body.number.trim();
      }
      if (body.hasOwnProperty('bmbyId')) {
        updateData.bmbyId = body.bmbyId;
      }
      if (body.hasOwnProperty('salutation')) {
        updateData.salutation = body.salutation;
      }
      if (body.hasOwnProperty('gender')) {
        updateData.gender = body.gender;
      }
      if (body.hasOwnProperty('country')) {
        updateData.country = body.country;
      }
      if (body.hasOwnProperty('isActive')) {
        updateData.isActive = body.isActive;
      }

      updateData.updatedBy = new Types.ObjectId(currentUserId);

      if (updateData.email && updateData.email !== contact.email) {
        const existingEmail = await Contact.findOne({
          companyId: contact.companyId,
          createdBy: contact.createdBy,
          email: updateData.email,
          _id: { $ne: contact._id },
          isArchived: false
        });

        if (existingEmail) {
          throw throwError(
            'Another contact with this email already exists',
            { status: 409 },
            'DUPLICATE_EMAIL'
          );
        }
      }

      if (updateData.number && updateData.number !== contact.number) {
        const existingPhone = await Contact.findOne({
          companyId: contact.companyId,
          createdBy: contact.createdBy,
          number: updateData.number,
          _id: { $ne: contact._id },
          isArchived: false
        });

        if (existingPhone) {
          throw throwError(
            'Another contact with this phone number already exists',
            { status: 409 },
            'DUPLICATE_PHONE'
          );
        }
      }

      if (updateData.bmbyId !== undefined && updateData.bmbyId !== contact.bmbyId) {
        const existingBmbyId = await Contact.findOne({
          companyId: contact.companyId,
          createdBy: contact.createdBy,
          bmbyId: updateData.bmbyId,
          _id: { $ne: contact._id },
          isArchived: false
        });

        if (existingBmbyId) {
          throw throwError(
            'Another contact with this client ID already exists',
            { status: 409 },
            'DUPLICATE_CLIENT_ID'
          );
        }
      }

      const updatedContact = await Contact.findByIdAndUpdate(
        body._id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      Server.log.info(
        {
          contactId: updatedContact?._id,
          updatedFields: Object.keys(updateData)
        },
        '✅ Contact updated successfully'
      );

      return {
        success: true,
        message: 'Contact updated successfully',
        data: updatedContact
      };
    } catch (error: any) {
      Server.log.error(error, '❌ Error in updateContact');
      throw error;
    }
  }

  /**
   * Delete contact (soft delete)
   */
  async deleteContact(user: any, body: any) {
    try {
      const { companyId, isHSAdmin, userId, _id, isAdmin: userIsAdmin } = user;
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const currentUserId = userId || _id;

      if (!body._id) {
        throw throwError('Contact ID is required', { status: 400 }, 'MISSING_CONTACT_ID');
      }

      const contact = await Contact.findOne({
        _id: new Types.ObjectId(body._id),
        isArchived: false
      });

      if (!contact) {
        throw throwError('Contact not found', { status: 404 }, 'CONTACT_NOT_FOUND');
      }

      const isAdmin = isHSAdmin || userIsAdmin || companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      if (!isAdmin && contact.createdBy.toString() !== currentUserId.toString()) {
        throw throwError('You can only delete your own contacts', { status: 403 }, 'FORBIDDEN');
      }

      Server.log.info(
        {
          contactId: body._id,
          currentUserId,
          contactCreatedBy: contact.createdBy,
          isAdmin
        },
        '🔐 Access check passed'
      );

      await Contact.findByIdAndUpdate(body._id, {
        $set: {
          isArchived: true,
          updatedBy: new Types.ObjectId(currentUserId)
        }
      });

      Server.log.info({ contactId: body._id }, '✅ Contact deleted (archived) successfully');

      return {
        success: true,
        message: 'Contact deleted successfully'
      };
    } catch (error: any) {
      Server.log.error(error, '❌ Error in deleteContact');
      throw error;
    }
  }

  /**
   * Bulk upload contacts from Excel
   */
  async bulkUploadContacts(user: any, parsedContacts: any[]) {
    try {
      const { companyId, userId, _id } = user;
      const currentUserId = userId || _id;

      Server.log.info(
        {
          userId: currentUserId,
          contactCount: parsedContacts.length
        },
        '📤 Starting bulk contact upload'
      );

      const validContacts: any[] = [];
      const invalidContacts: any[] = [];

      // ✅ Fetch existing contacts to check for duplicates
      const existingContacts = await Contact.find({
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(currentUserId),
        isArchived: false
      }).select('email number bmbyId').lean();

      const existingEmails = new Set(existingContacts.map(c => c.email.toLowerCase()));
      const existingPhones = new Set(existingContacts.map(c => c.number));
      const existingBmbyIds = new Set(existingContacts.map(c => c.bmbyId));

      // ✅ Track duplicates within the current upload file
      const uploadEmails = new Set<string>();
      const uploadPhones = new Set<string>();
      const uploadBmbyIds = new Set<number>();

      for (let i = 0; i < parsedContacts.length; i++) {
        const contact = parsedContacts[i];
        const rowNumber = i + 2;
        const errors: string[] = [];

        Server.log.info({ rowNumber, contact }, `🔍 Validating contact ${rowNumber}`);

        // ✅ REQUIRED: Email
        if (!contact.email || !contact.email.trim()) {
          errors.push('Email is required');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) {
          errors.push('Invalid email format');
        }

        // ✅ REQUIRED: Phone Number
        if (!contact.phone_number || !contact.phone_number.trim()) {
          errors.push('Phone number is required');
        }

        // ✅ REQUIRED: Client ID (bmbyId)
        if (
          contact.client_id === null ||
          contact.client_id === undefined ||
          contact.client_id === ''
        ) {
          errors.push('Client ID is required');
        } else if (isNaN(Number(contact.client_id))) {
          errors.push('Client ID must be a number');
        }

        // ✅ EXTRACT firstName from email if blank
        let firstName = contact.first_name;
        if (!firstName || firstName.trim() === '') {
          if (contact.email && contact.email.trim()) {
            firstName = contact.email.split('@')[0];
            Server.log.info(
              {
                rowNumber,
                email: contact.email,
                extractedFirstName: firstName
              },
              '🔧 firstName extracted from email'
            );
          } else {
            errors.push('First name is required (cannot extract from email)');
          }
        }

        // if (firstName && firstName.trim().length > 50) {
        //   errors.push('First name must be 50 characters or less');
        // }

        // if (contact.last_name && contact.last_name.trim().length > 50) {
        //   errors.push('Last name must be 50 characters or less');
        // }

        const phoneValidation = this.validatePhone(contact.phone_number);
        if (contact.phone_number && !phoneValidation.isValid) {
          errors.push(`Phone: ${phoneValidation.error}`);
        }

        if (contact.gender && contact.gender.trim()) {
          const genderLower = contact.gender.toLowerCase().trim();
          const validGenders = ['masculine', 'feminine', 'neuter', 'male', 'female', 'other'];

          if (!validGenders.includes(genderLower)) {
            errors.push('Gender must be: masculine, feminine, neuter, male, female, or other');
          }
        }

        if (contact.salutation && contact.salutation.trim()) {
          const normalizedSalutation = contact.salutation.trim();
          const validSalutations = ['Herr', 'Frau', 'Mr', 'Mrs', 'Ms', 'Dr', 'Prof'];

          if (!validSalutations.includes(normalizedSalutation)) {
            errors.push('Salutation must be: Herr, Frau, Mr, Mrs, Ms, Dr, or Prof');
          }
        }

        // ✅ Check for duplicate email
        if (contact.email && contact.email.trim()) {
          const emailLower = contact.email.trim().toLowerCase();

          if (existingEmails.has(emailLower)) {
            errors.push('Email already exists');
          } else if (uploadEmails.has(emailLower)) {
            errors.push('Duplicate email within uploaded file');
          }
        }

        // ✅ Check for duplicate phone number
        if (phoneValidation.isValid && phoneValidation.formatted) {
          if (existingPhones.has(phoneValidation.formatted)) {
            errors.push('Phone number already exists');
          } else if (uploadPhones.has(phoneValidation.formatted)) {
            errors.push('Duplicate phone number within uploaded file');
          }
        }

        // ✅ Check for duplicate bmbyId (Client ID)
        if (contact.client_id !== null && contact.client_id !== undefined && contact.client_id !== '') {
          const bmbyIdNumber = Number(contact.client_id);

          if (!isNaN(bmbyIdNumber)) {
            if (existingBmbyIds.has(bmbyIdNumber)) {
              errors.push('Client ID already exists');
            } else if (uploadBmbyIds.has(bmbyIdNumber)) {
              errors.push('Duplicate Client ID within uploaded file');
            }
          }
        }

        if (errors.length > 0) {
          Server.log.warn({ rowNumber, errors }, `❌ Contact ${rowNumber} validation failed`);

          invalidContacts.push({
            row_number: rowNumber,
            phone_number: contact.phone_number || '',
            salutation: contact.salutation || '',
            gender: contact.gender || '',
            first_name: contact.first_name || '',
            last_name: contact.last_name || '',
            email: contact.email || '',
            client_id: contact.client_id || '',
            country: contact.country || '',
            errors: errors.join(', ')
          });
        } else {
          Server.log.info({ rowNumber }, `✅ Contact ${rowNumber} validated successfully`);

          let mappedGender = '';
          if (contact.gender) {
            const genderLower = contact.gender.toLowerCase().trim();
            if (genderLower === 'masculine' || genderLower === 'male') {
              mappedGender = 'masculine';
            } else if (genderLower === 'feminine' || genderLower === 'female') {
              mappedGender = 'feminine';
            } else if (genderLower === 'neuter' || genderLower === 'other') {
              mappedGender = 'neuter';
            }
          }

          validContacts.push({
            number: phoneValidation.formatted || contact.phone_number.trim(),
            firstName: firstName ? firstName.trim() : '',
            lastName: contact.last_name ? contact.last_name.trim() : '',
            email: contact.email.trim().toLowerCase(),
            gender: mappedGender,
            salutation: contact.salutation ? contact.salutation.trim() : '',
            bmbyId: Number(contact.client_id),
            country: contact.country ? contact.country.trim() : '',
            companyId: new Types.ObjectId(companyId),
            createdBy: new Types.ObjectId(currentUserId),
            isArchived: false,
            isActive: true
          });

          // ✅ Track this contact's unique fields to prevent duplicates within upload
          uploadEmails.add(contact.email.trim().toLowerCase());
          uploadPhones.add(phoneValidation.formatted || contact.phone_number.trim());
          uploadBmbyIds.add(Number(contact.client_id));
        }
      }

      Server.log.info(
        {
          validCount: validContacts.length,
          invalidCount: invalidContacts.length
        },
        '📊 Validation complete'
      );

      let actuallyInserted = 0;
      let duplicateErrors = 0;

      if (validContacts.length > 0) {
        try {
          Server.log.info({ count: validContacts.length }, '💾 Inserting valid contacts');
          const result = await Contact.insertMany(validContacts, { ordered: false });
          actuallyInserted = result.length;
          Server.log.info({ count: actuallyInserted }, '✅ Contacts inserted successfully');
        } catch (insertError: any) {
          Server.log.error(insertError, '❌ Error inserting contacts');

          if (insertError.code === 11000) {
            if (insertError.insertedDocs) {
              actuallyInserted = insertError.insertedDocs.length;
            }

            duplicateErrors = validContacts.length - actuallyInserted;

            Server.log.error(
              {
                attempted: validContacts.length,
                inserted: actuallyInserted,
                duplicates: duplicateErrors
              },
              '❌ Duplicate key error'
            );

            if (duplicateErrors > 0) {
              invalidContacts.push({
                row_number: 0,
                phone_number: '',
                salutation: '',
                gender: '',
                first_name: '',
                last_name: '',
                email: '',
                client_id: '',
                country: '',
                errors: `${duplicateErrors} contact(s) failed during insertion (possible race condition or unique constraint violation)`
              });
            }
          }
        }
      }

      let validationReport = null;

      if (invalidContacts.length > 0) {
        Server.log.info({ count: invalidContacts.length }, '📄 Generating error report');

        const workbook = XLSX.utils.book_new();

        const errorSheetData = invalidContacts.map((contact) => ({
          'Row Number': contact.row_number,
          'Phone Number': contact.phone_number,
          Salutation: contact.salutation,
          Gender: contact.gender,
          'First Name': contact.first_name,
          'Last Name': contact.last_name,
          Email: contact.email,
          'Client ID': contact.client_id,
          Country: contact.country,
          Error: contact.errors
        }));

        const worksheet = XLSX.utils.json_to_sheet(errorSheetData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Errors');

        const excelBuffer = XLSX.write(workbook, {
          type: 'buffer',
          bookType: 'xlsx'
        });

        const base64Buffer = excelBuffer.toString('base64');

        validationReport = {
          fileName: `contact_errors_${Date.now()}.xlsx`,
          buffer: base64Buffer,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          note: 'Download this file to see validation errors'
        };

        Server.log.info({ fileName: validationReport.fileName }, '✅ Error report generated');
      }

      const response = {
        success: true,
        message: `Contacts upload completed. ${actuallyInserted} contacts added successfully${invalidContacts.length > 0 ? `, ${invalidContacts.length} failed` : ''}${duplicateErrors > 0 ? ` (${duplicateErrors} duplicates skipped)` : ''}.`,
        data: {
          totalRecords: parsedContacts.length,
          successCount: actuallyInserted,
          failedCount: invalidContacts.length + duplicateErrors,
          duplicateCount: duplicateErrors,
          validationReport: validationReport,
          hasErrors: invalidContacts.length > 0 || duplicateErrors > 0
        }
      };

      Server.log.info(response.data, '✅ Bulk upload completed');
      return response;
    } catch (error: any) {
      Server.log.error(error, '❌ Error in bulkUploadContacts');
      throw error;
    }
  }

  async exportListing(user: any, query: any): Promise<any> {
    const { companyId, isHSAdmin, userId: authUserId, _id, isAdmin: userIsAdmin } = user;
    const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;

    const {
      searchStr = '',
      sortBy = 'createdAt desc',
      isActive,
      userId: requestedUserId
    } = query;

    // Build filter
    let filter: any = { isArchived: false };

    // ============================================================================
    // USER-LEVEL ACCESS CONTROL
    // ============================================================================

    // Check if user is admin (using isAdmin field from user object)
    const isAdmin = isHSAdmin || userIsAdmin || companyId?.toString() === SUPER_ADMIN_COMPANY_ID;
    const currentUserId = authUserId || _id;

    Server.log.info({
      isHSAdmin,
      userIsAdmin,
      isAdmin,
      currentUserId,
      requestedUserId
    }, '🔍 Admin check details');

    if (isAdmin) {
      // ADMIN: Can view specific user's contacts OR their own
      const targetUserId = requestedUserId || currentUserId;
      filter.createdBy = new Types.ObjectId(targetUserId);

      Server.log.info({
        adminId: currentUserId,
        viewingUserId: targetUserId
      }, '🔐 Admin viewing contacts filtered by userId');

      // Company filter for non-super admins
      if (!isHSAdmin || companyId?.toString() !== SUPER_ADMIN_COMPANY_ID) {
        filter.companyId = new Types.ObjectId(companyId);
      }
    } else {
      // REGULAR USER: Only their own contacts
      filter.createdBy = new Types.ObjectId(currentUserId);
      filter.companyId = new Types.ObjectId(companyId);

      Server.log.info({
        userId: currentUserId
      }, '🔐 Regular user viewing own contacts only');

      if (requestedUserId && requestedUserId !== currentUserId.toString()) {
        Server.log.warn({
          userId: currentUserId,
          attemptedUserId: requestedUserId
        }, '⚠️  Regular user attempted to access other user contacts - blocked');
      }
    }

    // ============================================================================
    // ADDITIONAL FILTERS
    // ============================================================================

    if (typeof isActive === 'boolean') {
      filter.isActive = isActive;
    }

    if (searchStr && searchStr.trim()) {
      const searchTerm = searchStr.trim();
      filter.$or = [
        { firstName: { $regex: searchTerm, $options: 'i' } },
        { lastName: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { number: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // ============================================================================
    // SORTING
    // ============================================================================
    const sort: any = {};

    if (sortBy) {
      const sortParts = sortBy.trim().split(' ');
      const sortField = sortParts[0];
      const sortDirection = sortParts[1]?.toLowerCase();

      let direction = -1;
      if (sortDirection === 'asc') {
        direction = 1;
      } else if (sortDirection === 'desc') {
        direction = -1;
      }

      sort[sortField] = direction;
    } else {
      sort.createdAt = -1;
    }

    // ============================================================================
    // EXECUTE QUERY
    // ============================================================================
    Server.log.info({ filter, sort }, '🔍 Executing contact list query');

    const [contacts, total] = await Promise.all([
      Contact.find(filter)
        .populate('companyId', 'name')
        .populate('createdBy', 'firstName lastName email')
        .collation({ locale: 'en', strength: 2 })
        .sort(sort)
        .lean(),
      Contact.countDocuments(filter)
    ]);

    Server.log.info({
      contactsFound: contacts.length,
      total
    }, '✅ Contact list retrieved');


    const transformed = contacts.map((row) => {
      const data = {
        'salutation': row.salutation || '',
        'first_name': row.firstName || '',
        'last_name': row.lastName || '',
        'gender': row.gender || '',
        'email': row.email || '',
        'phone_number': row.number || '',
        'client_id': row.bmbyId || '',
        'country': row.country || ''
      };
      return toTitleCaseWithSpaces(data);
    });

    const worksheet = XLSX.utils.json_to_sheet(transformed);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');

    // Generate buffer
    const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return xlsxBuffer;

  }

  /**
   * Validate phone number
   */
  private validatePhone(phoneNumber: string): {
    isValid: boolean;
    formatted?: string;
    error?: string;
  } {
    if (!phoneNumber || !phoneNumber.trim()) {
      return { isValid: false, error: 'Phone number is required' };
    }

    let cleanPhone = phoneNumber.trim();

    if (!cleanPhone.startsWith('+') && /^\d+$/.test(cleanPhone)) {
      cleanPhone = '+' + cleanPhone;
      Server.log.info(
        {
          original: phoneNumber,
          fixed: cleanPhone
        },
        '🔧 Auto-fixed phone number by adding + prefix'
      );
    }

    try {
      const parsed = parsePhoneNumberFromString(cleanPhone);

      if (!parsed) {
        return { isValid: false, error: 'Invalid phone number format' };
      }

      if (!parsed.isValid()) {
        return { isValid: false, error: 'Phone number is not valid' };
      }

      return {
        isValid: true,
        formatted: parsed.format('E.164')
      };
    } catch (error) {
      const digitsOnly = cleanPhone.replace(/\D/g, '');

      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        return {
          isValid: false,
          error: 'Phone number must have 10-15 digits'
        };
      }

      return { isValid: true, formatted: cleanPhone };
    }
  }
}
