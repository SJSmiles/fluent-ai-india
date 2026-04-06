import { Types } from 'mongoose';
import { UserService } from '../../users/services/user.service';
import { Company } from '../models/company.model';
import { CompanyConfiguration } from '../../company-configuration/models/company-configuration.model';
import { CONFIG_TYPES } from '../../../config/server-config';
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

    // Resolve countryId if it's a country code
    let countryObjectId = null;
    if (payload?.address?.countryId) {
      countryObjectId = await this.resolveCountryId(payload.address.countryId);
    }

    // Create company
    const company: any = await Company.create({
      name: payload.name,
      interestedMeetingBooked: payload.interestedMeetingBooked,
      interestedTask: payload.interestedTask,
      notInterested: payload.notInterested,
      domain: payload.domain,
      description: payload.description,
      voiceProvider: payload.voiceProvider || 'vapi',
      voiceProviders: payload.voiceProviders,
      bmbyProfileActive: payload.bmbyProfileActive || false,
      address: {
        street: payload?.address?.street || '',
        houseNo: payload?.address?.houseNo || null,
        zipCode: payload?.address?.zipCode || null,
        state: payload?.address?.state || '',
        countryId: countryObjectId
      },
      api_key_id: payload?.api_key_id || null,
      createdBy: user._id
    });

    try {
      // Create default company configurations
      await this.createDefaultConfigurations(company._id, user._id);

      // Generate and update webhook token
      const webhookToken = generateWebhookToken(company._id.toString());

      await Company.findByIdAndUpdate(
        company._id,
        { webhookToken: webhookToken },
        { new: true }
      );

      // Create admin user
      const adminPayload = {
        firstName: 'Admin',
        lastName: company.name,
        email: payload.email,
        userName: payload.email.split('@')[0],
        password: payload.password,
        isAdmin: true,
        companyId: company._id,
        api_key_id: payload?.api_key_id || null,
        sheetConfig: true,
        bmbyConfig: true
      };

      const userService = new UserService();
      await userService.create(user, adminPayload);

      return {
        status: true,
        message: 'Company Created Successfully',
        data: {
          companyId: company._id,
          companyName: company.name,
          domain: company.domain,
          webhookToken: webhookToken
        }
      };
    } catch (err: any) {
      console.log('error creating company', err);
      // Rollback: Remove company and configurations if user creation fails
      await this.removeCompany(company._id);
      await CompanyConfiguration.deleteMany({ companyId: company._id });
      throw err;
    }
  }

  /**
   * Resolve countryId - accepts either ObjectId or country code
   */
  private async resolveCountryId(countryIdOrCode: string): Promise<Types.ObjectId | null> {
    try {
      // Check if it's already a valid ObjectId
      if (Types.ObjectId.isValid(countryIdOrCode) && countryIdOrCode.length === 24) {
        return new Types.ObjectId(countryIdOrCode);
      }

      // Otherwise, treat it as a country code and look it up
      const { CountryMaster } = require('../../country/models/country.model');
      const country = await CountryMaster.findOne({
        code: countryIdOrCode.toUpperCase(),
        isArchived: false
      }).select('_id').lean();

      return country ? country._id : null;
    } catch (err) {
      console.log('Error resolving country:', err);
      return null;
    }
  }

  private async createDefaultConfigurations(companyId: Types.ObjectId, userId: Types.ObjectId): Promise<void> {
    // Create sheet configuration
    const sheetConfig = {
      companyId: companyId,
      type: CONFIG_TYPES.SHEET,
      configuration: [
        { fieldName: 'clientId', type: 'number' as const, required: true },
        { fieldName: 'country', type: 'string' as const, required: false },
        { fieldName: 'email', type: 'string' as const, required: false },
      ],
      queueProcessInMinutes: 5,
      maximumAttempts: 3
    };

    // Create bmby configuration
    const bmbyConfig = {
      companyId: companyId,
      type: CONFIG_TYPES.BMBY,
      configuration: [
        { fieldName: 'userId', type: 'number' as const, required: true },
        { fieldName: 'projectId', type: 'number' as const, required: true }
      ]
    };

    // Insert both configurations
    await CompanyConfiguration.insertMany([sheetConfig, bmbyConfig]);
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

      // Parse sortBy similar to User service
      if (sortBy) {
        const sortParts = sortBy.trim().split(' ');

        if (sortParts.length > 1) {
          // Format: "fieldName asc" or "fieldName desc"
          sortField = sortParts[0];
          sortOrder = sortParts[1].toLowerCase() === 'asc' ? 1 : -1;
        } else {
          // Single field, check for prefix
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

        // Validate sort field
        if (!allowedSortFields.includes(sortField)) {
          sortField = 'createdAt';
          sortOrder = -1;
        }
      }

      const sortObject: any = { [sortField]: sortOrder };

      console.log('Sort configuration:', { sortBy, sortField, sortOrder, sortObject });

      const [companies, total] = await Promise.all([
        Company.find(query)
          .populate('createdBy', 'firstName lastName userName')
          .skip(Number(skip))
          .limit(Number(limit))
          .sort(sortObject)
          .lean(),
        Company.countDocuments(query)
      ]);

      // Fetch country details if needed
      const countryIds = companies.map((c: any) => c.address?.countryId).filter(Boolean);

      let countryMap: any = {};
      if (countryIds.length > 0) {
        try {
          const { CountryMaster } = require('../../country/models/country.model');
          const countries = await CountryMaster.find({
            _id: { $in: countryIds }
          })
            .select('_id name code')
            .lean();

          countryMap = countries.reduce((acc: any, country: any) => {
            acc[country._id.toString()] = {
              _id: country._id,
              name: country.name,
              code: country.code
            };
            return acc;
          }, {});
        } catch (err) {
          console.log('Error fetching countries:', err);
        }
      }

      const formattedCompanies = companies.map((company: any) => {
        const countryData = countryMap[company.address?.countryId?.toString()];

        // Format voice providers - mask API keys for security
        const voiceProviders = (company.voiceProviders || []).map((vp: any) => ({
          name: vp.name,
          // Mask API key for security (show only first 8 characters)
          api_key_id: vp.api_key_id ? `${vp.api_key_id}` : ''
        }));

        return {
          _id: company._id,
          name: company.name,
          interestedMeetingBooked: company.interestedMeetingBooked,
          interestedTask: company.interestedTask,
          notInterested: company.notInterested,
          domain: company.domain,
          voiceProviders: voiceProviders, // ✅ Changed from singular to array
          webhookToken: company.webhookToken || '',
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
          isActive: company.isActive ?? true,
          description: company.description || '',
          address: {
            street: company.address?.street || '',
            houseNo: company.address?.houseNo?.toString() || '',
            zipCode: company.address?.zipCode?.toString() || '',
            state: company.address?.state || '',
            country: countryData ? {
              _id: countryData._id,
              name: countryData.name,
              code: countryData.code
            } : null
          },
          bmbyConfig: company.bmbyProfileActive || false,
          defaultUserName: company.createdBy
            ? `${company.createdBy.firstName} ${company.createdBy.lastName}`
            : ''
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
    await Company.deleteOne({ _id: new Types.ObjectId(companyId) });
    await User.deleteMany({ companyId: new Types.ObjectId(companyId) });
    return true;
  }

  public async updateCompany(user: any, payload: any): Promise<any> {
    try {
      const { _id, name, description, address, voiceProviders, isActive, interestedMeetingBooked, interestedTask, notInterested } = payload;

      // Check if company exists
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
          name: name,
          _id: { $ne: new Types.ObjectId(_id) },
          isArchived: false
        });

        if (nameExists) {
          throw throwError('Company Name Already Exists');
        }
      }

      // Prepare update object
      const updateData: any = {};

      if (name !== undefined) {
        updateData.name = name;
      }

      if (interestedMeetingBooked !== undefined) {
        updateData.interestedMeetingBooked = interestedMeetingBooked;
      }
      if (interestedTask !== undefined) {
        updateData.interestedTask = interestedTask;
      }
      if (notInterested !== undefined) {
        updateData.notInterested = notInterested;
      }

      if (description !== undefined) {
        updateData.description = description;
      }

      if (isActive !== undefined) {
        updateData.isActive = isActive;
      }
      if (payload.bmbyProfileActive !== undefined) {
        updateData.bmbyProfileActive = payload.bmbyProfileActive;
      }

      // Handle voiceProviders update
      if (voiceProviders !== undefined && Array.isArray(voiceProviders)) {
        // Validate voice providers
        if (voiceProviders.length === 0) {
          throw throwError('At least one voice provider is required', { status: 400 });
        }

        // Validate each provider
        for (const provider of voiceProviders) {
          if (!provider.name || !provider.api_key_id) {
            throw throwError(
              'Each voice provider must have a name and api_key_id',
              { status: 400 }
            );
          }

          // Validate provider name
          const validProviders = ['vapi', 'retell'];
          if (!validProviders.includes(provider.name.toLowerCase())) {
            throw throwError(
              `Invalid voice provider: ${provider.name}. Allowed values: ${validProviders.join(', ')}`,
              { status: 400 }
            );
          }
        }

        // Check for duplicate provider names
        const providerNames = voiceProviders.map((p: any) => p.name.toLowerCase());
        const uniqueNames = new Set(providerNames);
        if (providerNames.length !== uniqueNames.size) {
          throw throwError('Duplicate voice provider names are not allowed', { status: 400 });
        }

        // Format voice providers
        updateData.voiceProviders = voiceProviders.map((vp: any) => ({
          name: vp.name.toLowerCase(),
          api_key_id: vp.api_key_id
        }));
      }

      // Handle address update
      if (address) {
        const addressUpdate: any = {};

        if (address.street !== undefined) {
          addressUpdate.street = address.street;
        }

        if (address.houseNo !== undefined) {
          addressUpdate.houseNo = address.houseNo;
        }

        if (address.zipCode !== undefined) {
          addressUpdate.zipCode = address.zipCode;
        }

        if (address.state !== undefined) {
          addressUpdate.state = address.state;
        }

        if (address.countryId !== undefined) {
          const countryObjectId = await this.resolveCountryId(address.countryId);
          addressUpdate.countryId = countryObjectId;
        }

        // Merge address updates
        if (Object.keys(addressUpdate).length > 0) {
          updateData.address = {
            ...existingCompany.address,
            ...addressUpdate
          };
        }
      }

      updateData.updatedAt = new Date();
      updateData.updatedBy = user._id;

      // Update company
      const updatedCompany = await Company.findByIdAndUpdate(
        new Types.ObjectId(_id),
        { $set: updateData },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedCompany) {
        throw throwError('Failed to update company', { status: 500 });
      }

      // Format response with masked API keys
      const responseVoiceProviders = (updatedCompany.voiceProviders || []).map((vp: any) => ({
        name: vp.name,
        api_key_id: vp.api_key_id ? `${vp.api_key_id.substring(0, 8)}...` : ''
      }));

      return {
        status: true,
        message: 'Company Updated Successfully',
        data: {
          companyId: updatedCompany._id,
          companyName: updatedCompany.name,
          description: updatedCompany.description,
          isActive: updatedCompany.isActive,
          voiceProviders: responseVoiceProviders,
          address: updatedCompany.address
        }
      };
    } catch (err: any) {
      console.log('Error updating company:', err);
      throw err;
    }
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

  public async getCountryMasterList(): Promise<any> {
    try {
      const { CountryMaster } = require('../../country/models/country.model');

      const countries = await CountryMaster.find({
        isArchived: false
      })
        .select('_id code name')
        .sort({ name: 1 })
        .lean();

      return {
        success: true,
        data: {
          countries: countries.map((country: any) => ({
            _id: country._id,
            code: country.code,
            name: country.name
          })),
          total: countries.length
        }
      };
    } catch (error: any) {
      console.log('Error fetching country master list:', error);
      throw throwError(error?.message || 'Failed to fetch country list', { status: 500 });
    }
  }

  public async getCompanyFilterList(): Promise<any> {
    try {
      const companies = await Company.find({ isArchived: false })
        .select('_id name domain bmbyProfileActive')
        .sort({ name: 1 })
        .lean();

      const companyIds = companies.map((c) => c._id);

      // Fetch configurations
      const configurations = await CompanyConfiguration.find({
        companyId: { $in: companyIds },
        type: { $in: ['bmby-configuration', 'sheet-configuration'] }
      })
        .select('companyId type')
        .lean();

      // ✅ Create config map (FIXED)
      const configMap = configurations.reduce((acc, config) => {
        const cid = config.companyId.toString();

        if (!acc[cid]) {
          acc[cid] = { bmbyConfig: false, sheetConfig: false };
        }

        if (config.type === 'bmby-configuration') {
          acc[cid].bmbyConfig = true;
        }

        if (config.type === 'sheet-configuration') {
          acc[cid].sheetConfig = true;
        }

        return acc;
      }, {} as Record<string, { bmbyConfig: boolean; sheetConfig: boolean }>);

      // ✅ Merge with companies
      const resultCompanies = companies.map((company) => {
        const cid = company._id.toString();

        const config = configMap[cid] || {
          bmbyConfig: false,
          sheetConfig: false
        };

        return {
          _id: company._id,
          name: company.name,
          domain: company.domain?.toLowerCase() || '', // ✅ safe
          // ✅ combine both conditions
          bmbyConfig: config.bmbyConfig && !!company.bmbyProfileActive,
          sheetConfig: config.sheetConfig
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

  public async generateCompanyToken(user: any, companyId: string): Promise<any> {
    try {
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      // Check if company exists
      const company = await Company.findById(companyId);
      if (!company) {
        throw throwError('Company not found', { status: 404 });
      }

      // Authorization check: Super admin can update any company, regular admin can only update their own
      if (!isSuperAdmin && user?.companyId?.toString() !== companyId) {
        throw throwError('Access denied. You can only generate token for your own company.', { status: 403 });
      }

      // Generate new webhook token
      const webhookToken = generateWebhookToken(companyId);

      // Update company with new token
      const updatedCompany = await Company.findByIdAndUpdate(
        companyId,
        { webhookToken: webhookToken },
        { new: true }
      );

      if (!updatedCompany) {
        throw throwError('Failed to update company with new token', { status: 404 });
      }

      return {
        success: true,
        message: 'Webhook token generated successfully',
        data: {
          companyId: updatedCompany._id,
          companyName: updatedCompany.name,
          webhookToken: webhookToken
        }
      };
    } catch (error: any) {
      throw throwError(error?.message || 'Failed to generate webhook token', { status: error?.status || 500 });
    }
  }
}

