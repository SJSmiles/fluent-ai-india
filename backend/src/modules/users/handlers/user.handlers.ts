import { UserService } from '../services/user.service';
import { throwError } from '../../../common/app-helper';
import { Server } from '../../../server';
import { User } from '../models/user.model';

const UserServiceInstance = new UserService();

export async function loginHandler(request: any, reply: any) {
  Server.log.info(request.body, 'Login request payload');
  if (
    !request.body.password &&
    String(request?.headers?.api_key) !== String(process.env.X_API_KEY)
  ) {
    throwError('Invalid User Login');
  }
  const result = await UserServiceInstance.login(request, reply, request.body);
  Server.log.info(result, 'Login response payload');
  return result;
}

export async function getCurrentUserHandler(request: any, reply: any) {
  const result = await UserServiceInstance.getCurrentUser(request, reply);
  return result;
}

export async function refreshTokenHandler(request: any, reply: any) {
  const result = await UserServiceInstance.generateRefreshToken(
    request,
    reply,
    request.user
  );
  return result;
}

export async function listUserHandler(request: any, reply: any) {
  try {
    if (!request.user?.isAdmin) {
      throw new Error('Permission denied: Admin access required');
    }

    const skip = parseInt(request.query.skip) || 0;
    const limit = parseInt(request.query.limit) || 10;
    const companyId = request.query.companyId || null;

    const result = await UserServiceInstance.listing(
      request.user,
      skip,
      limit,
      request.query.searchStr,
      request.query.sortBy,
      companyId  // Pass companyId filter
    );

    return reply.send(result);
  } catch (error) {
    throw error;
  }
}

export async function filterListUserHandler(request: any) {
  try {
    const { companyId } = request.query || {};

    console.log('🔍 DEBUG - Request Query:', request.query);
    console.log('🔍 DEBUG - Extracted companyId:', companyId);
    console.log('🔍 DEBUG - User Info:', {
      isSuperAdmin: request.user?.isSuperAdmin,
      isAdmin: request.user?.isAdmin,
      userCompanyId: request.user?.companyId
    });

    if (!request.user?.isAdmin && !request.user?.isSuperAdmin) {
      throw new Error('Permission denied: Admin or Super Admin access required');
    }

    // ✅ Pass both user info and optional companyId
    const result = await UserServiceInstance.getUserFilterListing(request.user, companyId);

    console.log('🔍 DEBUG - Result:', result);

    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error in filterListUserHandler');
    throw error;
  }
}

export async function createUserHandler(request: any) {
  try {
    // Check if current user is superAdmin
    const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
    const isSuperAdmin = request.user?.isSuperAdmin === true ||
      request.user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

    // Regular users must be admin, superAdmin can bypass this check
    if (!isSuperAdmin && !request.user?.isAdmin) {
      throw new Error('Permission denied: Admin access required');
    }

    Server.log.info(request.body, 'Create user request payload');
    const result = await UserServiceInstance.createUser(request.user, request.body);
    Server.log.info(result, 'Create user response payload');
    return result;
  } catch (error: any) {
    throw error;
  }
}

export async function registrationUserHandler(request: any) {
  const isUserExists = await User.countDocuments({
    email: { $regex: new RegExp(`^${request.body.email}$`, 'i') },
    isArchived: false
  });
  if (isUserExists) {
    return {
      status: true,
      statusCode: 200,
      message: 'Registration request processed successfully.'
    };
  }

  if (request.body.password !== request.body.confirmPassword) {
    return {
      status: false,
      statusCode: 400,
      message: 'Password and confirm password has to match.'
    };
  }

  const result = await UserServiceInstance.register(request.body);
  return {
    result
  };
}

export async function updateUserHandler(request: any) {
  try {
    if (!request.user?.isAdmin) {
      throw new Error('Permission denied: Admin access required');
    }
    Server.log.info(request.body, 'Update user request payload');
    const result = await UserServiceInstance.updateUser(request.user, request.body);
    Server.log.info(result, 'Update user response payload');
    return result;
  } catch (error) {
    throw error;
  }
}

export async function toggleUserStatusHandler(request: any) {
  try {
    if (!request.user?.isAdmin) {
      throw new Error('Permission denied: Admin access required');
    }
    Server.log.info(request.body, 'Toggle user status request payload');
    const result = await UserServiceInstance.toggleUserStatus(request.user, request.body);
    Server.log.info(result, 'Toggle user status response payload');
    return result;
  } catch (error) {
    throw error;
  }
}

export async function changePasswordHandler(request: any, reply: any) {
  try {
    // Check if current user is superAdmin
    const SUPER_ADMIN_COMPANY_ID = process.env.SUPER_ADMIN_COMPANY_ID;
    const isSuperAdmin = request.user?.isSuperAdmin === true ||
      request.user?.companyId?.toString() === SUPER_ADMIN_COMPANY_ID;

    // Regular users must be admin, superAdmin can bypass this check
    if (!isSuperAdmin && !request.user?.isAdmin) {
      throw new Error('Permission denied: Admin access required');
    }

    Server.log.info(request.body, 'Change Password request payload');
    const result = await UserServiceInstance.changePassword(request.user, {
      ...request.body
    });
    Server.log.info(result, 'Change Password response payload');
    return result;
  } catch (error) {
    throw error;
  }
}

export async function createXSignatureHandler(request: any) {
  try {
    // Step 1: Validate that the requesting user is an admin
    if (!request.user?.isAdmin) {
      throw {
        statusCode: 403,
        message: 'Access denied. Only admin users can create API keys.'
      };
    }

    Server.log.info({
      requestUser: {
        email: request.user?.email,
        isAdmin: request.user?.isAdmin,
        isSuperAdmin: request.user?.isSuperAdmin,
        companyId: request.user?.companyId
      },
      body: request.body
    }, 'Create X-Signature request');

    // Step 2: Call service to create X-Signature
    const result = await UserServiceInstance.createXSignature(
      request.user,
      request.body
    );

    Server.log.info(result, 'Create X-Signature response payload');
    return result;
  } catch (error: any) {
    Server.log.error(error, 'Error creating X-Signature');
    throw error;
  }
}

export async function listXSignatureKeysHandler(request: any, reply: any) {
  try {
    if (!request.user?.isAdmin) {
      throw {
        statusCode: 403,
        message: 'Access denied. Only admin users can list API keys.'
      };
    }

    const query = request.query;
    Server.log.info(query, 'List X-Signature query params');

    const result = await UserServiceInstance.listXSignatureKeys(request.user, query);
    return reply.send(result);
  } catch (error: any) {
    Server.log.error(error, 'Error listing X-Signature keys');
    throw error;
  }
}

export async function updateXSignatureKeyStatusHandler(request: any, reply: any) {
  try {
    const { _id, isActive } = request.body;

    // Step 1: Validate admin access
    if (!request.user?.isAdmin) {
      throw {
        statusCode: 403,
        message: 'Access denied. Only admin users can update API key status.'
      };
    }

    Server.log.info({
      requestUser: {
        email: request.user?.email,
        isAdmin: request.user?.isAdmin,
        isSuperAdmin: request.user?.isSuperAdmin,
        companyId: request.user?.companyId
      },
      body: request.body
    }, 'Update X-Signature key status request');

    // Step 2: Call service to update status
    const result = await UserServiceInstance.updateXSignatureKeyStatus(
      request.user,
      { _id, isActive }
    );

    return reply.send(result);
  } catch (error: any) {
    Server.log.error(error, 'Error updating X-Signature key status');
    throw error;
  }
}