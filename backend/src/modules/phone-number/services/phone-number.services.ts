import { PhoneNumber } from '../models/phone-number.model';
import { throwError } from '../../../common/app-helper';
import { Types } from 'mongoose';
import { Server } from '../../../server';

export class PhoneNumberService {

  /**
   * Create Phone Number
   */
  async createPhoneNumber(user: any, body: any) {
    try {
      const { companyId, userId, _id } = user;
      const currentUserId = userId || _id;
      const targetCompanyId = body.companyId || companyId;

      if (!body.name || !body.name.trim()) {
        throw throwError('Phone number name is required', { status: 400 }, 'MISSING_NAME');
      }

      if (!body.phoneNumber || !body.phoneNumber.trim()) {
        throw throwError('Phone number is required', { status: 400 }, 'MISSING_PHONE_NUMBER');
      }

      if (!body.phoneNumberId || !body.phoneNumberId.trim()) {
        throw throwError('Phone number ID is required', { status: 400 }, 'MISSING_PHONE_NUMBER_ID');
      }

      // Prevent duplicate phone number name per company
      const existingPhoneNumber = await PhoneNumber.findOne({
        companyId: new Types.ObjectId(targetCompanyId),
        $or: [
          { name: body.name.trim() },
          { phoneNumber: body.phoneNumber.trim() }
        ],
        isArchived: false
      });

      if (existingPhoneNumber) {
        throw throwError(
          'Phone number with this name or number already exists',
          { status: 409 },
          'DUPLICATE_PHONE_NUMBER'
        );
      }

      const newPhoneNumber = new PhoneNumber({
        name: body.name.trim(),
        phoneNumber: body.phoneNumber.trim(),
        phoneNumberId: body.phoneNumberId.trim(),
        companyId: new Types.ObjectId(targetCompanyId),
        createdBy: new Types.ObjectId(currentUserId)
      });

      await newPhoneNumber.save();

      Server.log.info(
        { phoneNumberId: newPhoneNumber._id },
        '✅ Phone number created successfully'
      );

      return {
        success: true,
        message: 'Phone number created successfully',
        data: newPhoneNumber
      };
    } catch (error: any) {
      Server.log.error(error, '❌ Error in createPhoneNumber');
      throw error;
    }
  }

  /**
   * Get Phone Number List
   */
  async getPhoneNumberList(user: any, query: any) {
    try {

      const {
        companyId,
        skip = 0,
        limit = 10,
        search = '',
        sortBy = 'createdAt desc'
      } = query;

      let filter: any = {
        companyId: new Types.ObjectId(companyId) || user.companyId,
        isArchived: false
      };

      if (search && search.trim()) {
        filter.$or = [
          { name: { $regex: search.trim(), $options: 'i' } },
          { phoneNumber: { $regex: search.trim(), $options: 'i' } }
        ];
      }

      // Sorting
      const sort: any = {};
      const sortParts = sortBy.split(' ');
      sort[sortParts[0]] = sortParts[1]?.toLowerCase() === 'asc' ? 1 : -1;



      const [phoneNumbers, total] = await Promise.all([
        PhoneNumber.find(filter)
          .populate('createdBy', 'firstName lastName email')
          .sort(sort)
          .skip(Number(skip))
          .limit(Number(limit))
          .lean(),
        PhoneNumber.countDocuments(filter)
      ]);

      return {
        success: true,
        message: 'Phone numbers retrieved successfully',
        data: {
          phoneNumbers,
          total,
          skip: Number(skip),
          limit: Number(limit)
        }
      };
    } catch (error: any) {
      Server.log.error(error, '❌ Error in getPhoneNumberList');
      throw error;
    }
  }

  /**
   * Get Phone Number Filter List
   */
  async getPhoneNumberFilterListing(user: any) {
    try {
      const { companyId } = user;

      const phoneNumbers = await PhoneNumber.find({
        companyId: new Types.ObjectId(companyId),
        isArchived: false
      })
        .select('name phoneNumber phoneNumberId _id')
        .lean();

      return {
        success: true,
        message: 'Phone numbers retrieved successfully',
        data: phoneNumbers
      };
    } catch (error: any) {
      Server.log.error(error, '❌ Error in getPhoneNumberFilterListing');
      throw error;
    }
  }

  /**
   * Update Phone Number
   */
  async updatePhoneNumber(user: any, body: any) {
    try {
      const { companyId, userId, _id } = user;
      const currentUserId = userId || _id;

      if (!body._id) {
        throw throwError('Phone number ID is required', { status: 400 }, 'MISSING_ID');
      }

      const phoneNumberObj = await PhoneNumber.findOne({
        _id: new Types.ObjectId(body._id),
        companyId: new Types.ObjectId(companyId),
        isArchived: false
      });

      if (!phoneNumberObj) {
        throw throwError('Phone number not found', { status: 404 }, 'NOT_FOUND');
      }

      const updateData: any = {};

      if (body.name && body.name.trim()) {
        // Check duplicate name
        const existing = await PhoneNumber.findOne({
          companyId: phoneNumberObj.companyId,
          name: body.name.trim(),
          _id: { $ne: phoneNumberObj._id },
          isArchived: false
        });

        if (existing) {
          throw throwError(
            'Another phone number with this name already exists',
            { status: 409 },
            'DUPLICATE_NAME'
          );
        }

        updateData.name = body.name.trim();
      }

      if (body.phoneNumber && body.phoneNumber.trim()) {
        const existingNumber = await PhoneNumber.findOne({
          companyId: phoneNumberObj.companyId,
          phoneNumber: body.phoneNumber.trim(),
          _id: { $ne: phoneNumberObj._id },
          isArchived: false
        });

        if (existingNumber) {
          throw throwError(
            'Another entry with this phone number already exists',
            { status: 409 },
            'DUPLICATE_PHONE_NUMBER'
          );
        }
        updateData.phoneNumber = body.phoneNumber.trim();
      }

      if (body.phoneNumberId && body.phoneNumberId.trim()) {
        updateData.phoneNumberId = body.phoneNumberId.trim();
      }

      updateData.updatedBy = new Types.ObjectId(currentUserId);

      const updatedPhoneNumber = await PhoneNumber.findByIdAndUpdate(
        phoneNumberObj._id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      Server.log.info(
        { phoneNumberId: phoneNumberObj._id },
        '✅ Phone number updated successfully'
      );

      return {
        success: true,
        message: 'Phone number updated successfully',
        data: updatedPhoneNumber
      };
    } catch (error: any) {
      Server.log.error(error, '❌ Error in updatePhoneNumber');
      throw error;
    }
  }

  /**
   * Delete Phone Number (Soft Delete)
   */
  async deletePhoneNumber(user: any, body: any) {
    try {
      const { companyId, userId, _id } = user;
      const currentUserId = userId || _id;

      if (!body._id) {
        throw throwError('Phone number ID is required', { status: 400 }, 'MISSING_ID');
      }

      const phoneNumberObj = await PhoneNumber.findOne({
        _id: new Types.ObjectId(body._id),
        companyId: new Types.ObjectId(companyId),
        isArchived: false
      });

      if (!phoneNumberObj) {
        throw throwError('Phone number not found', { status: 404 }, 'NOT_FOUND');
      }

      await PhoneNumber.findByIdAndUpdate(phoneNumberObj._id, {
        $set: {
          isArchived: true,
          updatedBy: new Types.ObjectId(currentUserId)
        }
      });

      Server.log.info(
        { phoneNumberId: phoneNumberObj._id },
        '✅ Phone number archived successfully'
      );

      return {
        success: true,
        message: 'Phone number deleted successfully'
      };
    } catch (error: any) {
      Server.log.error(error, '❌ Error in deletePhoneNumber');
      throw error;
    }
  }

  /**
   * Get Single Phone Number
   */
  async getSinglePhoneNumber(user: any, id: string) {
    try {
      const { companyId } = user;

      const phoneNumberObj = await PhoneNumber.findOne({
        _id: new Types.ObjectId(id),
        companyId: new Types.ObjectId(companyId),
        isArchived: false
      }).lean();

      if (!phoneNumberObj) {
        throw throwError('Phone number not found', { status: 404 }, 'NOT_FOUND');
      }

      return {
        success: true,
        message: 'Phone number retrieved successfully',
        data: phoneNumberObj
      };
    } catch (error: any) {
      Server.log.error(error, '❌ Error in getSinglePhoneNumber');
      throw error;
    }
  }
}
