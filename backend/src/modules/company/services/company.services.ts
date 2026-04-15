import { Types } from 'mongoose';
import { UserService } from '../../users/services/user.service';
import { Company } from '../models/company.model';
import { throwError } from '../../../common/app-helper';
import { User } from '../../users/models/user.model';
import { generateWebhookToken } from '../../users/helper/helper';
import { Server } from '../../../server';

interface QueryParams {
  skip?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
}

export class CompanyService {


  public async companyCreate(user: any, payload: any): Promise<any> {
    await this.validateCompany(payload);
    // Create company
    const company: any = await Company.create({
      name: payload.name,
      domain: payload.domain,
      description: payload.description,
      plivoAuthId: payload.plivoAuthId,
      plivoAuthToken: payload.plivoAuthToken,
      elevenLabsApiKey: payload.elevenLabsApiKey,
      deepgramApiKey: payload.deepgramApiKey,
      leadStatusPrompt: payload.leadStatusPrompt,
      callSummaryPrompt: payload.callSummaryPrompt,
      leadStatus: payload.leadStatus,
      csvColumnConfig: payload.csvColumnConfig,
      address: {
        street: payload?.address?.street || '',
        houseNo: payload?.address?.houseNo || null,
        zipCode: payload?.address?.zipCode || null,
        state: payload?.address?.state || '',
      },
      createdBy: user._id
    });

    try {
      // Create admin user
      const adminPayload = {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        password: payload.password,
        isAdmin: true,
        companyId: company._id
      };

      const userService = new UserService();
      await userService.create(user, adminPayload);

      return {
        status: true,
        message: 'Company Created Successfully',
        data: {
          companyId: company._id,
          companyName: company.name,
          domain: company.domain
        }
      };
    } catch (err: any) {
      console.log('error creating company', err);
      // Rollback: Remove company and configurations if user creation fails
      await this.removeCompany(company._id);
      throw err;
    }
  }



  public async updateCompany(user: any, payload: any): Promise<any> {
    try {
      const {
        _id,
        name,
        description,
        domain,
        plivoAuthId,
        plivoAuthToken,
        elevenLabsApiKey,
        deepgramApiKey,
        isActive,
        address,
        leadStatus,
        csvColumnConfig,
        leadStatusPrompt,
        callSummaryPrompt,
      } = payload;

      // Check company exists
      const existingCompany = await Company.findOne({
        _id: new Types.ObjectId(_id),
        isArchived: false
      });

      if (!existingCompany) {
        throw throwError('Company not found', { status: 404 });
      }

      // Validate name uniqueness if name is being changed
      if (name && name !== existingCompany.name) {
        const nameExists = await Company.findOne({
          name,
          _id: { $ne: new Types.ObjectId(_id) },
          isArchived: false
        });
        if (nameExists) {
          throw throwError('Company Name Already Exists');
        }
      }

      // Validate domain uniqueness if domain is being changed
      if (domain && domain !== existingCompany.domain) {
        const domainExists = await Company.findOne({
          domain,
          _id: { $ne: new Types.ObjectId(_id) },
          isArchived: false
        });
        if (domainExists) {
          throw throwError('Company Domain Already Exists');
        }
      }

      // Validate csvColumnConfig if provided
      if (csvColumnConfig && csvColumnConfig.length > 0) {
        const phoneColumns = csvColumnConfig.filter((c: any) => c.type === 'phone');
        if (phoneColumns.length !== 1) {
          throw throwError(
            `csvColumnConfig must contain exactly one column with type 'phone' (found ${phoneColumns.length})`
          );
        }

        const columnNames = csvColumnConfig.map((c: any) => c.name.toLowerCase());
        const duplicates = columnNames.filter(
          (name: string, idx: number) => columnNames.indexOf(name) !== idx
        );
        if (duplicates.length > 0) {
          throw throwError(
            `csvColumnConfig contains duplicate column names: ${[...new Set(duplicates)].join(', ')}`
          );
        }
      }

      // Build update object — only include fields present in the payload
      const updateData: any = {
        updatedAt: new Date(),
        updatedBy: user._id
      };

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (domain !== undefined) updateData.domain = domain;
      if (plivoAuthId !== undefined) updateData.plivoAuthId = plivoAuthId;
      if (plivoAuthToken !== undefined) updateData.plivoAuthToken = plivoAuthToken;
      if (elevenLabsApiKey !== undefined) updateData.elevenLabsApiKey = elevenLabsApiKey;
      if (deepgramApiKey !== undefined) updateData.deepgramApiKey = deepgramApiKey;
      if (leadStatusPrompt !== undefined) updateData.leadStatusPrompt = leadStatusPrompt;
      if (callSummaryPrompt !== undefined) updateData.callSummaryPrompt = callSummaryPrompt;
      if (isActive !== undefined) updateData.isActive = isActive;

      if (leadStatus !== undefined) {
        updateData.leadStatus = leadStatus
          .map((s: string) => s.trim())
          .filter(Boolean);
      }

      if (csvColumnConfig !== undefined) {
        updateData.csvColumnConfig = csvColumnConfig.map((col: any) => ({
          name: col.name.trim().toLowerCase(),
          label: col.label?.trim() || col.name.trim(),
          type: col.type,
          required: col.required ?? false,
          enum: Array.isArray(col.enum) ? col.enum.map((v: string) => v.trim()) : []
        }));
      }

      // Merge address fields — preserve existing values for keys not in payload
      if (address) {
        const addressUpdate: any = {};
        if (address.street !== undefined) addressUpdate.street = address.street;
        if (address.houseNo !== undefined) addressUpdate.houseNo = address.houseNo;
        if (address.zipCode !== undefined) addressUpdate.zipCode = address.zipCode;
        if (address.state !== undefined) addressUpdate.state = address.state;

        if (Object.keys(addressUpdate).length > 0) {
          updateData.address = { ...existingCompany.address, ...addressUpdate };
        }
      }

      const updatedCompany = await Company.findByIdAndUpdate(
        new Types.ObjectId(_id),
        { $set: updateData },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedCompany) {
        throw throwError('Failed to update company', { status: 500 });
      }

      return {
        status: true,
        message: 'Company Updated Successfully',
        data: {
          companyId: updatedCompany._id,
          companyName: updatedCompany.name,
          description: updatedCompany.description,
          domain: updatedCompany.domain,
          isActive: updatedCompany.isActive,
          address: updatedCompany.address,
          leadStatus: updatedCompany.leadStatus,
          csvColumnConfig: updatedCompany.csvColumnConfig,
          leadStatusPrompt: updatedCompany.leadStatusPrompt,
          callSummaryPrompt: updatedCompany.callSummaryPrompt,
        }
      };
    } catch (err: any) {
      console.log('Error updating company:', err);
      throw err;
    }
  }


  public async getCompanyList(queryParams: QueryParams): Promise<any> {
    try {
      const { skip = 0, limit = 10, search, sortBy = 'createdAt desc' } = queryParams;

      const query: any = { isArchived: false };

      if (search && search.trim()) {
        const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escapedSearch, 'i');

        query.$or = [
          { name: searchRegex },
          { domain: searchRegex },
          { description: searchRegex }
        ];
      }

      const allowedSortFields = ['name', 'domain', 'createdAt', 'updatedAt', 'isActive'];
      let sortField = 'createdAt';
      let sortOrder: 1 | -1 = -1;

      if (sortBy) {
        const sortParts = sortBy.trim().split(' ');

        if (sortParts.length > 1) {
          sortField = sortParts[0];
          sortOrder = sortParts[1].toLowerCase() === 'asc' ? 1 : -1;
        } else {
          if (sortBy.startsWith('-')) {
            sortField = sortBy.substring(1);
            sortOrder = -1;
          } else if (sortBy.startsWith('+')) {
            sortField = sortBy.substring(1);
            sortOrder = 1;
          } else {
            sortField = sortBy;
            sortOrder = -1;
          }
        }

        if (!allowedSortFields.includes(sortField)) {
          sortField = 'createdAt';
          sortOrder = -1;
        }
      }

      const sortObject: any = { [sortField]: sortOrder };

      const [companies, total] = await Promise.all([
        Company.find(query)
          .skip(Number(skip))
          .limit(Number(limit))
          .sort(sortObject)
          .lean(),
        Company.countDocuments(query)
      ]);

      const formattedCompanies = companies.map((company: any) => {
        return {
          _id: company._id,
          name: company.name,
          domain: company.domain,
          description: company.description || '',
          address: {
            street: company.address?.street || '',
            houseNo: company.address?.houseNo?.toString() || '',
            zipCode: company.address?.zipCode?.toString() || '',
            state: company.address?.state || '',
          },
          isActive: company.isActive ?? true,
          isArchived: company.isArchived ?? false,
          plivoAuthId: company.plivoAuthId || '',
          plivoAuthToken: company.plivoAuthToken || '',
          elevenLabsApiKey: company.elevenLabsApiKey || '',
          deepgramApiKey: company.deepgramApiKey || '',
          csvColumnConfig: company.csvColumnConfig || [],
          callStatus: company.callStatus || [],
          callStatusPrompt: company.callStatusPrompt || '',
          callSummaryPrompt: company.callSummaryPrompt || '',
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
        };
      });

      return {
        success: true,
        data: {
          companies: formattedCompanies,
          pagination: {
            total,
            skip: Number(skip),
            limit: Number(limit),
            hasMore: Number(skip) + Number(limit) < total
          }
        }
      };
    } catch (error: any) {
      throw throwError(error?.message || 'Failed to fetch companies', { status: 500 });
    }
  }



  public async validateCompany(payload: any) {
    const query: any = {
      $or: [{ domain: payload?.domain }, { name: payload?.name }],
      isArchived: false
    };

    if (payload?._id) {
      query._id = { $ne: new Types.ObjectId(payload._id) };
    }

    const isCompanyExists = await Company.findOne(query);

    if (isCompanyExists) {
      if (payload.domain === isCompanyExists.domain) {
        throw throwError('Domain Already Exists');
      }
      if (payload.name === isCompanyExists.name) {
        throw throwError('Company Name Already Exists');
      }
    }

    // Domain regex validation
    const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (payload?.domain && !domainRegex.test(payload?.domain)) {
      throw throwError('Invalid domain format');
    }

    return true;
  }

  public async removeCompany(companyId: any) {
    await Company.updateOne(
      { _id: new Types.ObjectId(companyId), isArchived: false },
      { $set: { isArchived: true } }
    );
    await User.updateMany(
      { companyId: new Types.ObjectId(companyId), isArchived: false },
      { $set: { isArchived: true } }
    );
    return true;
  }



  // NEW: Toggle company status method
  public async toggleCompanyStatus(user: any, payload: any): Promise<any> {
    try {
      const { _id, isActive } = payload;

      // Check if company exists
      const existingCompany = await Company.findOne({
        _id: new Types.ObjectId(_id),
        isArchived: false
      });

      if (!existingCompany) {
        throw throwError('Company not found', { status: 404 });
      }

      // Check if status is actually changing
      if (existingCompany.isActive === isActive) {
        return {
          status: true,
          message: `Company is already ${isActive ? 'active' : 'inactive'}`,
          data: {
            companyId: existingCompany._id,
            companyName: existingCompany.name,
            isActive: existingCompany.isActive
          }
        };
      }

      // Update company status
      const updatedCompany = await Company.findByIdAndUpdate(
        new Types.ObjectId(_id),
        {
          $set: {
            isActive: isActive,
            updatedAt: new Date()
          }
        },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedCompany) {
        throw throwError('Failed to update company status', { status: 500 });
      }

      // Update all users' status when company is deactivated
      if (isActive === false) {
        const userUpdateResult = await User.updateMany(
          {
            companyId: new Types.ObjectId(_id),
            isArchived: false
          },
          {
            $set: {
              status: 0,
              updatedAt: new Date()
            }
          }
        );

        Server.log.info(
          {
            companyId: _id,
            usersUpdated: userUpdateResult.modifiedCount
          },
          'Deactivated all users for company'
        );

        return {
          status: true,
          message: 'Company and associated users deactivated successfully',
          data: {
            companyId: updatedCompany._id,
            companyName: updatedCompany.name,
            isActive: updatedCompany.isActive,
            usersDeactivated: userUpdateResult.modifiedCount
          }
        };
      }
      return {
        status: true,
        message: 'Company activated successfully',
        data: {
          companyId: updatedCompany._id,
          companyName: updatedCompany.name,
          isActive: updatedCompany.isActive
        }
      };
    } catch (err: any) {
      console.log('Error toggling company status:', err);
      throw err;
    }
  }


  public async getCompanyFilterList(): Promise<any> {
    try {
      const companies = await Company.find({ isArchived: false })
        .select('_id name domain')
        .sort({ name: 1 })
        .lean();

      const resultCompanies = companies.map((company) => {
        return {
          _id: company._id,
          name: company.name,
          domain: company.domain?.toLowerCase() || '',
        };
      });

      console.log('Fetched companies for filter list with configs:', resultCompanies);

      return {
        success: true,
        data: {
          companies: resultCompanies,
          total: resultCompanies.length
        }
      };

    } catch (error: any) {
      console.error('Error fetching company filter list:', error);
      throw throwError(error?.message || 'Failed to fetch company list', { status: 500 });
    }
  }
}

