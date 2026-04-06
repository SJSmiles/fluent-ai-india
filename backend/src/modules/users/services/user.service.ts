import bcrypt from 'bcrypt';
import { Types } from 'mongoose';

import { ERROR_MESSAGE } from '../../../common/error-message';
import { throwError } from '../../../common/app-helper';

import { CompanyService } from '../../company/services/company.services';
import { CONFIG_TYPES, USER_STATUS } from '../../../config/server-config';

import { User } from '../models/user.model';
import { Company } from '../../company/models/company.model';
import { generateRefreshToken, generateToken, validateToken, verifyRefreshToken } from '../../../common/jwt';
import { Environment } from '../../../config/environment';
import { generateWebhookToken, validatePhone } from '../helper/helper';
import { UserApiKeys } from '../models/userApiKeys.model';
import { CompanyConfiguration } from '../../company-configuration/models/company-configuration.model';
import { Server } from '../../../server';

const crypto = require('crypto');

export class UserService {
  // Hash a password
  public async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  }

  // Verify the password
  public async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
  }


  public async getCurrentUser(request: any, reply: any): Promise<any> {
    try {
      // Try access token first
      const authHeader = request.headers['authorization'];
      const accessToken = authHeader && authHeader.split(' ')[1];

      if (accessToken) {
        await validateToken(request);
        if (!request?.user?.userId) {
          throwError('Unauthorized access', { status: 403 });
        }

        const userData: any = await User.findOne({
          _id: new Types.ObjectId(request.user.userId),
          isArchived: false
        });

        console.log('userData', userData);

        let bmbyConfig = false;
        let sheetConfig = false;
        let companyDetails: any;
        if (userData?.companyId) {
          companyDetails = await Company.findOne({ _id: userData.companyId });

          const companyConfigs = await CompanyConfiguration.find({
            companyId: userData.companyId
          }).select('type');

          if (companyConfigs?.length) {
            bmbyConfig = companyConfigs.some((c) => c.type === CONFIG_TYPES.BMBY && companyDetails?.bmbyProfileActive);
            sheetConfig = companyConfigs.some((c) => c.type === CONFIG_TYPES.SHEET);
          }
        }

        let profileCompletion = userData.profileCompletion;
        if (!bmbyConfig) {
          profileCompletion = true;
        }

        // Check if user belongs to Super Admin company
        const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
        const isSuperAdmin = userData?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

        if (userData && parseInt(userData.tokenVersion) === parseInt(request.user.tokenVersion)) {
          return {
            // isHSAdmin: userData.isHSAdmin,
            isAdmin: userData.isAdmin,
            isSuperAdmin: isSuperAdmin,
            _id: userData._id,
            firstName: userData?.firstName,
            lastName: userData?.lastName,
            companyId: userData?.companyId,
            email: userData?.email,
            phoneNumber: userData?.phoneNumber,
            isArchived: userData.isArchived,
            createdBy: userData.createdBy,
            updatedBy: userData.updatedBy,
            createdAt: userData.createdAt,
            updatedAt: userData.updatedAt,
            profileCompletion: profileCompletion,
            bmbyConfig: bmbyConfig,
            sheetConfig: sheetConfig
          };
        }
        else {
          throw throwError('UnAuthorized', { status: 401 }, 'REMOTE_UNAUTHORIZED');
        }
      }
    }
    catch (error) {
      console.error("Access token invalid/expired:", error);

      let refreshToken;
      if (request?.user?.isMobile) {
        refreshToken = request.body.refreshToken;
      } else {
        refreshToken = request.cookies.refreshToken;
      }

      if (!refreshToken) {
        throw throwError('No valid tokens found', { status: 401 }, 'NO_TOKENS');
      }

      const decoded = await verifyRefreshToken(refreshToken);
      const user: any = await User.findOne({
        _id: new Types.ObjectId(decoded.userId),
        isArchived: false
      });


      if (!user || user.tokenVersion <= 0) {
        throw throwError('Invalid refresh token', { status: 401 }, 'REMOTE_UNAUTHORIZED');
      }

      // Generate new access token
      const newAccessToken = await generateToken(user);
      const newRefreshToken = await generateRefreshToken(user, decoded.rememberMe);

      await User.updateOne(
        { _id: new Types.ObjectId(user._id) },
        {
          $set: {
            lastLoginAt: user.lastLoginAt,
            tokenVersion: (user.tokenVersion || 0) + 1
          }
        }
      );

      let profileCompletion = user?.profileCompletion;
      let bmbyConfig = false;
      let sheetConfig = false;

      let companyDetails: any;
      if (user?.companyId) {
        companyDetails = await Company.findOne({ _id: user.companyId });

        const companyConfigs = await CompanyConfiguration.find({
          companyId: user.companyId
        }).select('type');

        if (companyConfigs?.length) {
          bmbyConfig = companyConfigs.some((c) => c.type === CONFIG_TYPES.BMBY && companyDetails?.bmbyProfileActive);
          sheetConfig = companyConfigs.some((c) => c.type === CONFIG_TYPES.SHEET);
        }
      }

      if (!bmbyConfig) {
        profileCompletion = true;
      }

      // Check if user belongs to Super Admin company
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      const response: any = {
        // isHSAdmin: user.isHSAdmin,
        isAdmin: user.isAdmin,
        isSuperAdmin: isSuperAdmin,
        _id: user._id,
        firstName: user?.firstName,
        lastName: user?.lastName,
        companyId: user?.companyId,
        email: user?.email,
        phoneNumber: user?.phoneNumber,
        isArchived: user.isArchived,
        createdBy: user.createdBy,
        updatedBy: user.updatedBy,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        newAccessToken: newAccessToken,
        profileCompletion: profileCompletion,
        bmbyConfig: bmbyConfig,
        sheetConfig: sheetConfig
      }

      if (request?.user?.isMobile) {
        response.refreshToken = newRefreshToken;
      } else {
        // Web: Update cookie with new refresh token
        const cookieConfig = decoded.rememberMe ? Environment.REMEMBER_COOKIE_CONFIG : Environment.COOKIE_CONFIG;
        reply.setCookie('refreshToken', newRefreshToken, cookieConfig);
      }

      return response;
    }
  }

  public async create(user: any, payload: any): Promise<any> {

    console.log(payload, 'Payload in user creation');
    const isUserExists = await User.countDocuments({
      email: { $regex: new RegExp(`^${payload.email}$`, 'i') },
      isArchived: false,
      companyId: new Types.ObjectId(payload.companyId)
    });
    if (isUserExists) {
      throwError(ERROR_MESSAGE.REGISTRATION_FAILED, 400);
    }
    if (!payload?.companyId) {
      throw new Error('Company ID is required');
    }
    const companyDetail: any = await Company.findOne({
      _id: new Types.ObjectId(payload.companyId)
    });
    if (!companyDetail) {
      throw new Error('Company not found');
    }
    if (companyDetail?.isArchived) {
      throw new Error('Company is archived');
    }
    const businessName = payload?.email.substring(payload?.email.lastIndexOf('@') + 1);
    if (companyDetail?.domain.toLocaleLowerCase() !== businessName.toLocaleLowerCase()) {
      throw throwError('Email and company Domain Name should be the same');
    }

    let hashedPassword: string | undefined;
    hashedPassword = await this.hashPassword(payload?.password);

    let profileCompletion = false;
    if (payload?.bmbyUserName && payload?.bmbyPassword && payload?.bmbyProjectId && payload?.bmbyUserId) {
      profileCompletion = true;
    }

    const userObj: any = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload?.email,
      phoneNumber: payload?.phoneNumber,
      companyId: payload?.companyId,
      password: hashedPassword,
      profileCompletion: profileCompletion,
      bmbyUserName: payload?.bmbyUserName || '',
      bmbyPassword: payload?.bmbyPassword || '',
      bmbyProjectId: payload?.bmbyProjectId || '',
      bmbyUserId: payload?.bmbyUserId || '',
      status: USER_STATUS.ACTIVE,
      isAdmin: payload?.isAdmin || false,
      createdBy: user?.userId || null,
      updatedBy: user?.userId || null,
      sheetConfig: payload?.sheetConfig || false,
      bmbyConfig: payload?.bmbyConfig || false
    };

    await User.create(userObj);
    return { status: true };
  }

  public async userOnBoard(user: any, payload: any) {
    const CompanyServiceInstance: any = new CompanyService();

    const domain = payload.email.split('@')[1];
    let company = await Company.findOne({ domain });
    if (!company) {
      const companyPayload = {
        name: payload.companyName || domain,
        domain: domain,
        description: 'Auto-created company',
        address: {
          street: payload.address?.street || '',
          houseNo: payload.address?.houseNo || '',
          zipCode: payload.address?.zipCode || '',
          state: payload.address?.state || '',
          countryId: payload.address?.countryId || null
        },
        users: [payload] // the user becomes the admin
      };

      const companyResponse = await CompanyServiceInstance.companyCreate(user, companyPayload);
      return companyResponse;
    } else {
      // Company exists, create a user under it
      payload.companyId = company._id;
      payload.isAdmin = false;

      await this.create(user, payload);
      return { status: true, message: 'User onboarded to existing company' };
    }
  }

  public async generateRefreshToken(request: any, reply: any, user: any) {
    try {
      const refreshToken = request.isMobile ? request.body.refreshToken : await request.cookies.refreshToken;


      if (!refreshToken) {
        throwError('Refresh token is required', { status: 400 });
      }

      const decoded = await verifyRefreshToken(refreshToken);
      if (!decoded) {
        throwError('Invalid refresh token', { status: 401 });
      }
      const userDetail: any = await User.findOne({
        email: decoded.email,
        isArchived: false
      });

      if (!userDetail) {
        throwError('User not found');
      }

      const newAccessToken = await generateToken(userDetail);

      const newRefreshToken = await generateRefreshToken(userDetail, decoded.rememberMe);

      const response: any = {
        success: true,
        data: {
          accessToken: newAccessToken
        },
        message: 'Tokens refreshed successfully'
      };

      userDetail.lastLoginAt = new Date();
      userDetail.tokenVersion = (userDetail.tokenVersion || 0) + 1;
      await User.updateOne
        (
          { _id: new Types.ObjectId(userDetail._id) },
          {
            $set: {
              lastLoginAt: userDetail.lastLoginAt,
              tokenVersion: userDetail.tokenVersion
            }
          }
        );
      // Platform-specific handling
      if (request?.user?.isMobile) {
        response.data.refreshToken = newRefreshToken;
      } else {
        // Web: Update cookie with new refresh token
        const cookieConfig = decoded.rememberMe ? Environment.REMEMBER_COOKIE_CONFIG : Environment.COOKIE_CONFIG;
        reply.setCookie('refreshToken', newRefreshToken, cookieConfig);
      }

      return response;
    } catch (err) {

      throwError('Invalid or expired refresh token', { status: 401 });
    }
  }

  public async listing(
    user: any,
    skip: number,
    limit: number,
    searchString?: string,
    sortBy?: string,
    companyId?: string  // NEW: Optional companyId filter
  ) {
    try {
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      // Build match condition
      let matchCondition: any = {
        isArchived: false
      };

      // If super admin and companyId filter is provided, use it
      // Otherwise, use user's own companyId
      if (isSuperAdmin && companyId) {
        matchCondition.companyId = new Types.ObjectId(companyId);
      } else if (isSuperAdmin && !companyId) {
        // Super admin without filter - show all users (excluding super admin company users)
        matchCondition.companyId = { $ne: new Types.ObjectId(SUPER_ADMIN_COMPANY_ID) };
      } else {
        // Regular admin - show only their company users
        matchCondition.companyId = new Types.ObjectId(user.companyId);
      }

      // Add search condition if searchString is provided
      if (searchString && searchString.trim()) {
        const escapedSearch = searchString.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escapedSearch, 'i');

        matchCondition.$or = [
          { firstName: { $regex: searchRegex } },
          { lastName: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
          { phoneNumber: { $regex: searchRegex } }
        ];
      }

      // Default sort by createdAt descending
      let $sort: any = { createdAt: -1 };
      if (sortBy) {
        const sort = sortBy.split(' ');
        if (sort.length > 1) {
          $sort = {
            [sort[0]]: sort[1].toLowerCase() === 'asc' ? 1 : -1
          };
        }
      }

      const result = await User.aggregate([
        {
          $match: matchCondition
        },
        {
          // Lookup company information
          $lookup: {
            from: 'Company',
            localField: 'companyId',
            foreignField: '_id',
            as: 'company'
          }
        },
        {
          $unwind: {
            path: '$company',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          // Exclude sensitive fields
          $project: {
            password: 0,
            bmbyPassword: 0,
            'company.webhookToken': 0
          }
        },
        {
          $sort: $sort
        },
        {
          $facet: {
            // Get the paginated data
            data: [{ $skip: skip }, { $limit: limit }],
            // Get the total count
            totalCount: [{ $count: 'count' }]
          }
        }
      ]);

      const users = result[0]?.data || [];
      const totalCount = result[0]?.totalCount[0]?.count || 0;

      return {
        message: 'Users retrieved successfully',
        data: users,
        totalCount: totalCount,
        isSuperAdmin: isSuperAdmin
      };
    } catch (err) {
      throwError('Failed to fetch users', err);
    }
  }

  public async getUserFilterListing(user: any, companyId?: string): Promise<any> {
    try {

      if (!user.isAdmin && !user.isSuperAdmin) {
        throw throwError('Access denied. Please contact admin.', { status: 403 }, 'FORBIDDEN');
      }

      const isSuperAdminCompany = user.companyId?.toString() === process.env.SUPER_ADMIN_COMPANY_ID;

      let targetCompanyId: string | undefined;

      if (user.isSuperAdmin || isSuperAdminCompany) {
        targetCompanyId = companyId || user.companyId?.toString();
      } else if (user.isAdmin) {
        targetCompanyId = user.companyId?.toString();

        if (companyId && companyId !== targetCompanyId) {
          console.warn('⚠️ Regular Admin attempted to access different company:', companyId);
        }

        console.log('🔍 Regular Admin - Target CompanyId (own company only):', targetCompanyId);
      }

      if (!targetCompanyId) {
        throw throwError('Company ID is missing', { status: 400 }, 'BAD_REQUEST');
      }

      console.log('🔍 Final Query CompanyId:', targetCompanyId);

      const data = await User.find(
        {
          companyId: new Types.ObjectId(targetCompanyId),
          isArchived: { $ne: true }
        },
        'firstName lastName _id email'
      ).lean();

      return {
        status: true,
        message: 'User List retrieved successfully',
        data
      };
    } catch (error: any) {
      throw throwError(
        `Failed to retrieve User list: ${error.message}`,
        { status: 500 },
        'INTERNAL_SERVER_ERROR'
      );
    }
  }

  public async createUser(user: any, payload: any): Promise<any> {
    try {
      // Check if current user is superAdmin
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.isSuperAdmin === true ||
        user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      // Determine target companyId
      // SuperAdmin can specify companyId in payload, otherwise use their own companyId
      const targetCompanyId = isSuperAdmin && payload.companyId
        ? payload.companyId
        : user.companyId;

      const userCompany = await Company.findOne({
        _id: new Types.ObjectId(targetCompanyId),
        isArchived: false
      });

      if (!userCompany) {
        throwError('Company not found or archived');
      }

      // Extract email domain
      const emailDomain = payload.email.substring(payload.email.lastIndexOf('@') + 1);

      // Check if email domain matches company domain
      if (emailDomain.toLowerCase() !== userCompany?.domain.toLowerCase()) {
        throwError('Email domain must match company domain');
      }

      // Check for duplicate email within the target company
      const emailExists = await User.findOne({
        email: {
          $regex: new RegExp(`^${payload.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        },
        companyId: new Types.ObjectId(targetCompanyId),
        isArchived: false
      });

      if (emailExists) {
        throwError('User with this email already exists in the company');
      }

      // Validate phone number (only numbers)
      if (payload.phoneNumber) {
        try {
          const isValid = validatePhone(payload.phoneNumber);
          if (!isValid) {
            throwError(
              'Invalid phone number format. Please include country code (e.g., +49xxxxxxxxxx)'
            );
          }
        } catch (error) {
          throwError(
            'Invalid phone number format. Please include country code (e.g., +49xxxxxxxxxx)'
          );
        }
      }

      // Hash password
      const hashedPassword = await this.hashPassword(payload.password);

      const companyConfigs = await CompanyConfiguration.find({
        companyId: targetCompanyId
      }).select('type');

      const hasBmbyConfig = companyConfigs.some((c) => c.type === CONFIG_TYPES.BMBY);
      const hasSheetConfig = companyConfigs.some((c) => c.type === CONFIG_TYPES.SHEET);

      // --- ✅ Determine profile completion logic ---
      let profileCompletion = false;
      console.log("hasBmbyConfig", hasBmbyConfig);

      if (!hasBmbyConfig) {
        // If bmby config doesn't exist → mark profile completed by default
        profileCompletion = true;
      } else {
        // If bmby config exists → require bmby fields
        const hasBmbyFields = payload?.bmbyProjectId && payload?.bmbyUserId;
        profileCompletion = hasBmbyFields ? true : false;
      }

      // Create user object
      const userObj = {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload?.email,
        phoneNumber: payload?.phoneNumber || null,
        password: hashedPassword,
        companyId: targetCompanyId,
        profileCompletion: profileCompletion,
        bmbyProjectId: payload.bmbyProjectId || "",
        bmbyUserId: payload.bmbyUserId || "",
        status: payload.status !== undefined ? payload.status : 1,
        isAdmin: false,
        isHSAdmin: false,
        isArchived: false,
        createdBy: user.userId,
        updatedBy: user.userId,
        bmbyConfig: hasBmbyConfig,
        sheetConfig: hasSheetConfig
      };

      // Create the user
      await User.create(userObj);

      // Optional: Log for audit trail
      if (isSuperAdmin && payload.companyId) {
        Server.log?.info({
          createdUserId: userObj.email,
          createdBy: user.email || user.userId,
          isSuperAdmin: true,
          targetCompanyId: targetCompanyId
        }, 'User created by superAdmin for another company');
      }

      return {
        status: true,
        message: 'User created successfully'
      };
    } catch (error: any) {
      if (error.message) {
        throwError(error.message);
      }
      throwError(error);
    }
  }

  public async register(payload: any) {
    try {
      const emailParts = payload.email.split('@');
      const name = emailParts[0];
      const domain = emailParts[1];

      // Check if company exists with this domain
      const companyExist = await Company.findOne({
        domain: domain.toLowerCase(),
        isArchived: false
      });

      let companyId: Types.ObjectId;
      let isAdmin = false;

      if (companyExist) {
        companyId = companyExist._id;
      } else {
        const companyPayload = {
          name: name,
          domain: domain.toLowerCase(),
          description: 'Auto-created company during registration',
          address: {
            street: '',
            houseNo: '',
            zipCode: '',
            state: '',
            countryId: null
          }
        };

        const companyResponse = await Company.create(companyPayload);

        // Fix: Check if company creation failed
        if (!companyResponse) {
          return {
            status: false,
            statusCode: 400,
            message: 'Failed to create company.'
          };
        }

        companyId = companyResponse._id;
        isAdmin = true;

        // Generate webhook token using company ID
        const webhookToken = generateWebhookToken(companyId.toString());

        // Update company with webhook token
        await Company.findByIdAndUpdate(
          companyId,
          { webhookToken: webhookToken },
          { new: true }
        );
      }

      // Hash password
      const hashedPassword = await this.hashPassword(payload.password);

      // Create user object
      const userObj = {
        firstName: name,
        lastName: '',
        email: payload.email.toLowerCase(),
        companyId: companyId,
        password: hashedPassword,
        status: USER_STATUS.ACTIVE,
        isAdmin: isAdmin,
        createdBy: null,
        updatedBy: null
      };

      // Create user
      const newUser = await User.create(userObj);

      return {
        status: true,
        statusCode: 200,
        message: isAdmin
          ? 'Registration successful! You are the admin of the new company.'
          : 'Registration successful! You have been added to the existing company.',
        data: {
          user: {
            id: newUser._id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            companyId: newUser.companyId,
            isAdmin: newUser.isAdmin
          }
        }
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        status: false,
        statusCode: 500,
        message: error
      };
    }
  }



  public async login(req: any, res: any, payload: any) {
    try {
      if (!payload?.email || !payload?.password) {
        throwError('Email and password are required');
      }

      // Find user by email
      let userDetail: any = await User.findOne({
        email: { $regex: new RegExp(`^${payload.email}$`, 'i') },
        isArchived: false
      });

      // Check if user exists
      if (!userDetail) {
        throwError('User not found');
      }

      if (!userDetail.status) {
        throwError('User not active: please contact to admin');
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(payload.password, userDetail.password);

      if (!isPasswordValid) {
        throwError('Invalid email or password');
      }

      userDetail.lastLoginAt = new Date();
      userDetail.tokenVersion = (userDetail.tokenVersion || 0) + 1;

      console.log("userDetail.tokenVersion", userDetail.tokenVersion);
      await User.updateOne
        (
          { _id: new Types.ObjectId(userDetail._id) },
          {
            $set: {
              lastLoginAt: userDetail.lastLoginAt,
              tokenVersion: userDetail.tokenVersion
            }
          }
        );

      const rememberMe = !!payload.rememberMe;

      // Clean token generation calls
      const accessToken = await generateToken(userDetail);
      const refreshToken = await generateRefreshToken(userDetail, rememberMe);


      const response: any = {
        success: true,
        data: {
          user: {
            id: userDetail.id,
            username: userDetail.username,
            email: userDetail.email,
            roles: userDetail.roles,
            lastLoginAt: userDetail.lastLoginAt
          },
          accessToken
        },
        message: 'Login successful'
      };

      // Platform-specific token handling
      if (req.isMobile) {
        // Mobile: Return refresh token in response (will be stored in secure storage)
        response.data.refreshToken = refreshToken;
      } else {
        // Web: Set refresh token as httpOnly cookie
        const cookieConfig = rememberMe ? Environment.REMEMBER_COOKIE_CONFIG : Environment.COOKIE_CONFIG;


        res.cookie('refreshToken', refreshToken, cookieConfig);
      }
      return response;
    } catch (error: any) {
      if (error) {
        throwError(error);
      } else {
        throwError('Login failed. Please try again.');
      }
    }
  }

  public async updateUser(user: any, payload: any): Promise<any> {
    try {
      const userId = payload._id;

      if (!Types.ObjectId.isValid(userId)) {
        throwError('Invalid user ID format');
      }

      // Check if current user is superAdmin
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.isSuperAdmin === true ||
        user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      // Build query based on user role
      const query: any = {
        _id: new Types.ObjectId(userId),
        isArchived: false
      };

      // Only apply companyId filter if not superAdmin
      if (!isSuperAdmin) {
        query.companyId = new Types.ObjectId(user.companyId);
      }

      const existingUser: any = await User.findOne(query);

      if (!existingUser) {
        throwError('User not found or you do not have permission to update this user');
      }

      // Enhanced phone number validation
      if (payload.phoneNumber) {
        try {
          const isValid = validatePhone(payload.phoneNumber);
          if (!isValid) {
            throwError(
              'Invalid phone number format. Please include country code (e.g., +49xxxxxxxxxx)'
            );
          }
        } catch (validationError) {
          throwError(
            'Invalid phone number format. Please include country code (e.g., +49xxxxxxxxxx)'
          );
        }
      }

      // Use the target user's companyId for fetching configurations
      const targetCompanyId = existingUser.companyId;

      const companyConfigs = await CompanyConfiguration.find({
        companyId: targetCompanyId
      }).select('type');

      const hasBmbyConfig = companyConfigs.some((c) => c.type === CONFIG_TYPES.BMBY);
      const hasSheetConfig = companyConfigs.some((c) => c.type === CONFIG_TYPES.SHEET);

      // Determine bmby field values
      const bmbyProjectId = payload.bmbyProjectId !== undefined
        ? payload.bmbyProjectId
        : existingUser.bmbyProjectId;

      const bmbyUserId = payload.bmbyUserId !== undefined
        ? payload.bmbyUserId
        : existingUser.bmbyUserId;

      // ✅ Compute profileCompletion based on BMBY config
      let profileCompletion = false;

      if (!hasBmbyConfig) {
        // If company has no BMBY configuration → mark profile completed by default
        profileCompletion = true;
      } else {
        // If BMBY config exists → require both bmby fields
        if (bmbyProjectId && bmbyUserId) {
          profileCompletion = true;
        }
      }

      const updateFields = {
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        phoneNumber: payload.phoneNumber,
        // status removed - use toggle-status endpoint instead
        updatedBy: user.userId,
        profileCompletion: profileCompletion,
        ...(hasBmbyConfig && { bmbyProjectId: bmbyProjectId }),
        ...(hasBmbyConfig && { bmbyUserId: bmbyUserId }),
        bmbyConfig: hasBmbyConfig,
        sheetConfig: hasSheetConfig
      };

      const updatedUser = await User.findByIdAndUpdate(
        new Types.ObjectId(userId),
        { $set: updateFields },
        {
          new: true,
          select: '-password'
        }
      );

      // Optional: Log for audit trail (similar to reference code)
      if (isSuperAdmin) {
        Server.log?.info({
          userId: userId,
          updatedBy: user.email || user.userId,
          isSuperAdmin: true,
          targetCompanyId: targetCompanyId
        }, 'User updated by superAdmin');
      }

      return {
        status: true,
        message: 'User updated successfully'
      };
    } catch (error: any) {
      if (error.message) {
        throwError(error.message);
      }
      throwError(error);
    }
  }

  // NEW: Toggle user status method
  public async toggleUserStatus(user: any, payload: any): Promise<any> {
    try {
      const { _id, status } = payload;

      if (!Types.ObjectId.isValid(_id)) {
        throwError('Invalid user ID format');
      }

      // Check if current user is superAdmin
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.isSuperAdmin === true ||
        user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      // Build query based on user role
      const query: any = {
        _id: new Types.ObjectId(_id),
        isArchived: false
      };

      // Only apply companyId filter if not superAdmin
      if (!isSuperAdmin) {
        query.companyId = new Types.ObjectId(user.companyId);
      }

      // Find the user
      const existingUser: any = await User.findOne(query);

      if (!existingUser) {
        throwError('User not found or you do not have permission to update this user');
      }

      // Check if status is actually changing
      if (existingUser.status === status) {
        const statusText = status === 1 ? 'active' : 'inactive';
        return {
          status: true,
          message: `User is already ${statusText}`,
          data: {
            userId: existingUser._id,
            userName: `${existingUser.firstName} ${existingUser.lastName}`,
            status: existingUser.status
          }
        };
      }

      // CRITICAL: If trying to activate user (status = 1), check if company is active
      if (status === 1) {
        const userCompany = await Company.findOne({
          _id: existingUser.companyId,
          isArchived: false
        }).lean();

        if (!userCompany) {
          throwError('Company not found');
        }

        if (userCompany && !userCompany.isActive) {
          throwError('Cannot activate user. The company is currently inactive. Please activate the company first.', { status: 400 });
        }
      }

      // Update user status
      const updatedUser = await User.findByIdAndUpdate(
        new Types.ObjectId(_id),
        {
          $set: {
            status: status,
            updatedBy: user.userId,
            updatedAt: new Date()
          }
        },
        {
          new: true,
          select: '-password'
        }
      ).lean();

      if (!updatedUser) {
        throwError('Failed to update user status', { status: 500 });
        return;
      }

      const statusText = status === 1 ? 'activated' : 'deactivated';

      // Log for audit trail
      Server.log?.info({
        userId: _id,
        updatedBy: user.email || user.userId,
        newStatus: status,
        companyId: existingUser.companyId
      }, `User ${statusText} by admin`);

      return {
        status: true,
        message: `User ${statusText} successfully`,
        data: {
          userId: updatedUser._id,
          userName: `${updatedUser.firstName} ${updatedUser.lastName}`,
          status: updatedUser.status,
          email: updatedUser.email
        }
      };
    } catch (error: any) {
      if (error.message) {
        throwError(error.message);
      }
      throwError(error);
    }
  }

  public async changePassword(user: any, payload: any) {
    try {
      // Check if current user is superAdmin
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = user?.isSuperAdmin === true ||
        user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      const userDetail: any = await User.findOne({
        _id: new Types.ObjectId(payload?._id),
        isArchived: false
      });

      if (!userDetail) {
        throw new Error('User not found');
      }

      // Check if target user is admin and currentPassword is required
      if (userDetail?.isAdmin && !payload?.currentPassword && !isSuperAdmin) {
        throw new Error('Current password is required for admin users');
      }

      // Validate company access (skip for superAdmin)
      if (!isSuperAdmin) {
        if (!new Types.ObjectId(userDetail?.companyId).equals(new Types.ObjectId(user?.companyId))) {
          throw new Error('Access denied: User does not belong to the specified company.');
        }
      }

      // Verify current password
      if (userDetail?.isAdmin && payload?.currentPassword) {
        const isChangingOwnPassword = user.userId?.toString() === payload._id?.toString();

        if (isChangingOwnPassword) {
          // Changing own password - verify against own password
          if (!(await this.verifyPassword(payload?.currentPassword, userDetail?.password))) {
            throw new Error('Current password is incorrect');
          }
        } else if (isSuperAdmin) {
          // SuperAdmin changing another admin's password - verify against superAdmin's password
          const superAdminDetail = await User.findOne({
            _id: new Types.ObjectId(user.userId),
            isArchived: false
          });

          if (!superAdminDetail) {
            throw new Error('SuperAdmin not found');
          }

          if (!(await this.verifyPassword(payload?.currentPassword, superAdminDetail?.password))) {
            throw new Error('Your current password is incorrect');
          }
        } else {
          // Regular admin changing another admin's password (shouldn't happen but validate)
          throw new Error('You do not have permission to change this admin password');
        }
      }

      // Hash and update new password
      userDetail.password = await this.hashPassword(payload?.newPassword);
      await userDetail.save();

      // Optional: Log for audit trail
      if (isSuperAdmin && userDetail.companyId?.toString() !== user.companyId?.toString()) {
        Server.log?.info({
          targetUserId: payload._id,
          targetUserEmail: userDetail.email,
          changedBy: user.email || user.userId,
          isSuperAdmin: true,
          targetCompanyId: userDetail.companyId
        }, 'Password changed by superAdmin for user from another company');
      }

      return { message: 'Password changed successfully' };
    } catch (error: any) {
      throw error;
    }
  }

  public async createXSignature(requestUser: any, body: any) {
    try {
      const { email, expiryTime } = body;

      // Step 1: Validate admin access
      if (!requestUser?.isAdmin) {
        throw {
          statusCode: 403,
          message: 'Access denied. Only admin users can create API keys.'
        };
      }

      // Step 2: Check if user is super admin
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = requestUser?.isSuperAdmin === true ||
        requestUser?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      // Step 3: Find the target user by email
      const targetUser = await User.findOne({
        email: email,
        isArchived: false
      }).lean();

      if (!targetUser) {
        throw {
          statusCode: 404,
          message: `User with email ${email} not found`
        };
      }

      // Step 4: Validate company access (unless super admin)
      if (!isSuperAdmin) {
        // Regular admin can only create keys for users in their own company
        if (targetUser.companyId.toString() !== requestUser.companyId.toString()) {
          throw {
            statusCode: 403,
            message: 'Cannot create API keys for users from other companies'
          };
        }
      }

      // Step 5: Validate expiry time is in the future
      const expiryDate = new Date(expiryTime);
      if (expiryDate <= new Date()) {
        throw {
          statusCode: 400,
          message: 'Expiry time must be a future date'
        };
      }

      // Step 6: Ensure email exists and generate unique API token with email and expiry time
      if (!targetUser.email) {
        throw {
          statusCode: 400,
          message: 'Target user email is missing for API key generation'
        };
      }
      const token = this.generateUniqueToken(targetUser.email as string, expiryDate);

      // Step 7: Create API key record
      const apiKey = await UserApiKeys.create({
        userId: targetUser._id,
        userEmail: targetUser.email,
        companyId: targetUser.companyId,
        token: token,
        expiryTime: expiryDate,
        isActive: true,
        createdBy: new Types.ObjectId(requestUser._id),
        createdAt: new Date()
      });

      console.log('API Key created:', apiKey);

      Server.log.info({
        apiKeyId: apiKey._id,
        targetUser: targetUser.email,
        createdBy: requestUser.email,
        isSuperAdmin
      }, 'X-Signature key created successfully');

      return {
        message: 'API key created successfully',
        data: {
          _id: apiKey._id,
          userId: apiKey.userId,
          userEmail: apiKey.userEmail,
          companyId: apiKey.companyId,
          token: apiKey.token,
          expiryTime: apiKey.expiryTime,
          isActive: apiKey.isActive,
          createdAt: apiKey.createdAt
        }
      };

    } catch (err: any) {
      Server.log.error(err, 'Error in createXSignature service');
      throw {
        statusCode: err.statusCode || 500,
        message: err.message || 'Failed to create API key'
      };
    }
  }

  private generateUniqueToken(email: string, expiryTime: Date): string {
    const crypto = require('crypto');

    // Step 1: Create payload with user email and expiry time
    const payload = {
      userEmail: email,
      expiryTime: expiryTime.toISOString()
    };

    // Step 2: Convert payload to JSON and encode in Base64
    const payloadString = JSON.stringify(payload);
    const base64Payload = Buffer.from(payloadString).toString('base64');

    // Step 3: Generate a signature (hash) for the payload
    const signature = crypto.randomBytes(32).toString('hex');

    // Step 4: Combine base64 payload and signature with a dot separator
    const token = `${base64Payload}.${signature}`;

    return token;
  }

  public async listXSignatureKeys(requestUser: any, query: any) {
    const {
      companyId,
      skip = 0,
      limit = 10,
      isActive,
      userEmail,
      sortBy = 'createdAt desc'
    } = query;

    try {
      // Step 1: Validate admin access
      if (!requestUser?.isAdmin) {
        throw {
          statusCode: 403,
          message: 'Access denied. Only admin users can view API keys.'
        };
      }

      // Step 2: Check if user is super admin
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = requestUser?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      // Step 3: Build filter based on user role
      let filter: any = {};

      if (isSuperAdmin && companyId) {
        // Super admin with specific company filter
        filter.companyId = new Types.ObjectId(companyId);
      } else if (isSuperAdmin && !companyId) {
        // Super admin without filter - show all keys (excluding super admin company)
        filter.companyId = { $ne: new Types.ObjectId(SUPER_ADMIN_COMPANY_ID) };
      } else {
        // Regular admin - show only their company keys
        filter.companyId = new Types.ObjectId(requestUser.companyId);
      }

      // Step 4: Add optional filters
      if (typeof isActive !== 'undefined') {
        filter.isActive = isActive;
      }

      if (userEmail && userEmail.trim()) {
        filter.userEmail = new RegExp(userEmail.trim(), 'i');
      }

      // Step 5: Handle sorting
      let sort: any = { createdAt: -1 };
      if (sortBy) {
        const [field, order] = sortBy.trim().split(/\s+/);
        const allowedFields = ['_id', 'userEmail', 'createdAt', 'expiryTime'];
        if (allowedFields.includes(field)) {
          sort = { [field]: order?.toLowerCase() === 'asc' ? 1 : -1 };
        }
      }

      // Step 6: Fetch records (simple version without company lookup)
      const [items, totalCount] = await Promise.all([
        UserApiKeys.find(filter)
          .select('_id userId userEmail createdAt token isActive expiryTime createdBy companyId')
          .sort(sort)
          .skip(Number(skip))
          .limit(Number(limit))
          .lean(),
        UserApiKeys.countDocuments(filter)
      ]);

      // Step 7: Return
      return {
        message: 'X-Signature keys retrieved successfully',
        data: items,
        totalCount: totalCount,
        // isSuperAdmin: isSuperAdmin
      };

    } catch (err: any) {
      Server.log.error(err, 'Error in listXSignatureKeys service');
      throw {
        statusCode: err.statusCode || 500,
        message: err.message || 'Failed to fetch X-Signature keys'
      };
    }
  }

  public async updateXSignatureKeyStatus(requestUser: any, body: any) {
    try {
      const { _id, isActive } = body;

      // Step 1: Validate admin access
      if (!requestUser?.isAdmin) {
        throw {
          statusCode: 403,
          message: 'Access denied. Only admin users can update API key status.'
        };
      }

      // Step 2: Check if user is super admin
      const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
      const isSuperAdmin = requestUser?.isSuperAdmin === true ||
        requestUser?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

      // Step 3: Find the API key
      const apiKey = await UserApiKeys.findById(_id).lean();

      if (!apiKey) {
        throw {
          statusCode: 404,
          message: 'API key not found'
        };
      }

      // Step 4: Validate company access (unless super admin)
      if (!isSuperAdmin) {
        // Regular admin can only update keys from their own company
        if (apiKey.companyId.toString() !== requestUser.companyId.toString()) {
          throw {
            statusCode: 403,
            message: 'Cannot update API keys from other companies'
          };
        }
      }

      // Step 5: Update the status
      const updatedKey = await UserApiKeys.findByIdAndUpdate(
        _id,
        {
          isActive: isActive,
          updatedAt: new Date(),
          updatedBy: requestUser._id
        },
        { new: true }
      ).lean();

      // Ensure updatedKey is not null before accessing its properties
      if (!updatedKey) {
        throw {
          statusCode: 404,
          message: 'Failed to update API key status'
        };
      }

      Server.log.info({
        apiKeyId: _id,
        newStatus: isActive,
        updatedBy: requestUser.email,
        isSuperAdmin
      }, 'X-Signature key status updated');

      return {
        message: `API key ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: {
          _id: updatedKey._id,
          userId: updatedKey.userId,
          userEmail: updatedKey.userEmail,
          companyId: updatedKey.companyId,
          isActive: updatedKey.isActive,
          updatedAt: updatedKey.updatedAt
        }
      };

    } catch (err: any) {
      Server.log.error(err, 'Error in updateXSignatureKeyStatus service');
      throw {
        statusCode: err.statusCode || 500,
        message: err.message || 'Failed to update API key status'
      };
    }
  }

}