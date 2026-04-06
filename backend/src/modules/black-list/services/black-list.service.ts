import { Types } from 'mongoose';
import { BlackList } from '../models/black-list.model';
import { Server } from '../../../server';

export class BlackListService {

  public static async escapeRegex(input: string) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  public static async listBlackList(requestUser: any, query: any) {
    const {
      companyId,
      skip = 0,
      limit = 10,
      searchStr,
      sortBy = 'createdAt desc'
    } = query;

    try {
      // Step 1: Validate admin access
      if (!requestUser?.isAdmin) {
        throw {
          statusCode: 403,
          message: 'Access denied. Only admin users can view blacklisted numbers.'
        };
      }

      // Step 2: Check if user is super admin
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = requestUser?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      // Step 3: Build filter based on user role
      let filter: any = {
        isArchived: false
      };

      if (isSuperAdmin && companyId) {
        filter.companyId = new Types.ObjectId(companyId);
      } else if (isSuperAdmin && !companyId) {
        console.log('this is true')
        filter.companyId = new Types.ObjectId(requestUser.companyId);
      } else {
        filter.companyId = new Types.ObjectId(requestUser.companyId);
      }

      if (searchStr) {
        const escapedSearch = await this.escapeRegex(searchStr.trim())
        const searchRegex = new RegExp(escapedSearch, 'i');
        const isNumber = !isNaN(Number(searchStr.trim()));

        const searchFilter = {
          $or: [
            { toNumber: { $regex: searchRegex } },
            { clientName: { $regex: searchRegex } },
            { email: { $regex: searchRegex } },
            { bmbyId: { $regex: searchRegex } },
          ]
        };
        if (filter.$and) {
          filter.$and.push(searchFilter);
        } else if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, searchFilter];
          delete filter.$or;
        } else {
          Object.assign(filter, searchFilter);
        }
      }

      let sort: any = { createdAt: -1 };
      if (sortBy) {
        const [field, order] = sortBy.trim().split(/\s+/);
        const allowedFields = ['_id', 'toNumber', 'clientName', 'createdAt', 'updatedAt', 'bmbyId'];
        if (allowedFields.includes(field)) {
          sort = { [field]: order?.toLowerCase() === 'asc' ? 1 : -1 };
        }
      }

      // Step 6: Fetch records
      const [items, totalCount] = await Promise.all([
        BlackList.find(filter)
          .select('_id toNumber companyId createdBy clientName bmbyId email isArchived createdAt updatedAt')
          .sort(sort)
          .skip(Number(skip))
          .limit(Number(limit))
          .lean(),
        BlackList.countDocuments(filter)
      ]);

      // Step 7: Return response
      return {
        message: 'Blacklisted numbers retrieved successfully',
        data: items,
        totalCount: totalCount
      };

    } catch (err: any) {
      Server.log.error(err, 'Error in listBlackList service');
      throw {
        statusCode: err.statusCode || 500,
        message: err.message || 'Failed to fetch blacklisted numbers'
      };
    }
  }

  public static async removeFromBlackList(requestUser: any, blackListId: string) {
    try {
      // Step 1: Validate admin access
      if (!requestUser?.isAdmin) {
        throw {
          statusCode: 403,
          message: 'Access denied. Only admin users can remove blacklisted numbers.'
        };
      }

      // Step 2: Validate blackListId
      if (!Types.ObjectId.isValid(blackListId)) {
        throw {
          statusCode: 400,
          message: 'Invalid blacklist ID format.'
        };
      }

      // Step 3: Find the blacklist record
      const blackListRecord = await BlackList.findOne({
        _id: new Types.ObjectId(blackListId),
        isArchived: false
      });

      if (!blackListRecord) {
        throw {
          statusCode: 404,
          message: 'Blacklist record not found or already archived.'
        };
      }

      // Step 4: Check if user is super admin
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = requestUser?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      // Step 5: Verify user has permission to archive this record
      if (!isSuperAdmin && blackListRecord.companyId.toString() !== requestUser.companyId.toString()) {
        throw {
          statusCode: 403,
          message: 'Access denied. You can only remove blacklisted numbers from your own company.'
        };
      }

      // Step 6: Archive the record
      const updatedRecord = await BlackList.findByIdAndUpdate(
        blackListId,
        {
          $set: {
            isArchived: true,
            updatedAt: new Date()
          }
        },
        { new: true }
      ).lean();

      // Step 7: Return response
      return {
        message: 'Number successfully removed from blacklist',
        data: updatedRecord
      };

    } catch (err: any) {
      Server.log.error(err, 'Error in removeFromBlackList service');
      throw {
        statusCode: err.statusCode || 500,
        message: err.message || 'Failed to remove number from blacklist'
      };
    }
  }
}
