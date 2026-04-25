import bcrypt from 'bcrypt';
import { Types } from 'mongoose';

import { ERROR_MESSAGE } from '../../../common/error-message';
import { throwError } from '../../../common/app-helper';

import { USER_STATUS } from '../../../config/server-config';

import { User } from '../models/user.model';
import { Company } from '../../company/models/company.model';
import { generateRefreshToken, generateToken, validateToken, verifyRefreshToken } from '../../../common/jwt';
import { Environment } from '../../../config/environment';
import { validatePhone } from '../helper/helper';
import { Server } from '../../../server';

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

        // Check if user belongs to Super Admin company
        const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
        const isSuperAdmin = userData?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;
        console.log(userData?.companyId?.toString(), SUPER_ADMIN_COMPANY_ID, 'Company ID check for super admin');

        if (userData && parseInt(userData.tokenVersion) === parseInt(request.user.tokenVersion)) {
          return {
            isAdmin: userData.isAdmin,
            superAdmin: isSuperAdmin,
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
            updatedAt: userData.updatedAt
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


      let companyDetails: any;
      if (user?.companyId) {
        companyDetails = await Company.findOne({ _id: user.companyId });
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
        domain: companyDetails?.domain || '',
        isArchived: user.isArchived,
        createdBy: user.createdBy,
        updatedBy: user.updatedBy,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        newAccessToken: newAccessToken,
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
    const isSuperAdmin = user?.isSuperAdmin || user?.companyId?.toString() === process.env.SUPER_ADMIN_COMPANY_ID;

    const isUserExists = await User.countDocuments({
      email: { $regex: new RegExp(`^${payload.email}$`, 'i') },
      isArchived: false,
      companyId: isSuperAdmin ? new Types.ObjectId(payload.companyId) : new Types.ObjectId(user.companyId)
    });
    if (isUserExists) {
      throwError(ERROR_MESSAGE.REGISTRATION_FAILED, 400);
    }
    if (!payload?.companyId && !isSuperAdmin) {
      throw new Error('Company ID is required');
    }
    const companyDetail: any = await Company.findOne({
      _id: new Types.ObjectId(isSuperAdmin ? payload.companyId : user.companyId)
    });
    if (!companyDetail) {
      throw new Error('Company not found');
    }
    if (companyDetail?.isArchived) {
      throw new Error('Company is archived');
    }

    if (!companyDetail?.isActive) {
      throw new Error('Company is not active');
    }
    const businessName = payload?.email.substring(payload?.email.lastIndexOf('@') + 1);
    if (companyDetail?.domain.toLocaleLowerCase() !== businessName.toLocaleLowerCase()) {
      throw throwError('Email and company Domain Name should be the same');
    }

    let hashedPassword: string | undefined;
    hashedPassword = await this.hashPassword(payload?.password);


    const userObj: any = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload?.email,
      phoneNumber: payload?.phoneNumber,
      companyId: payload?.companyId,
      password: hashedPassword,
      status: USER_STATUS.ACTIVE,
      isAdmin: payload?.isAdmin || false,
      createdBy: user?.userId || null,
      updatedBy: user?.userId || null,
    };

    await User.create(userObj);
    return { status: true };
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
    companyId?: string
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
          // Include only requested fields
          $project: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            email: 1,
            isAdmin: 1,
            phoneNumber: 1,
            updatedAt: 1,
            createdAt: 1,
            status: 1,
            isArchived: 1
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

      // Create user object
      const userObj = {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload?.email,
        phoneNumber: payload?.phoneNumber || null,
        password: hashedPassword,
        companyId: targetCompanyId,
        status: payload.status !== undefined ? payload.status : 1,
        isAdmin: payload?.isAdmin || false,
        isHSAdmin: false,
        isArchived: false,
        createdBy: user.userId,
        updatedBy: user.userId,
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
      const keys = Object.keys(payload || {});
      console.log('📦 DEBUG - updateUser Payload Keys:', keys);
      console.log('📦 DEBUG - updateUser Payload Email:', payload?.email);
      
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

      existingUser.firstName = payload.firstName.trim();
      existingUser.lastName = payload.lastName.trim();
      existingUser.email = payload.email ? payload.email.trim() : existingUser.email;
      existingUser.phoneNumber = payload.phoneNumber;
      existingUser.isAdmin = payload.isAdmin;
      existingUser.updatedBy = user.userId;

      console.log('📝 DEBUG - Saving user:', existingUser.email);
      await existingUser.save();

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
}