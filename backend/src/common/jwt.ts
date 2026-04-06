// jwt.ts - Modified validateToken function

import { FastifyRequest } from 'fastify';
import memoize from './memoize';
import ms from 'ms';
import { createSigner, createVerifier } from 'fast-jwt';
import crypto from 'crypto';

import { User } from '../modules/users/models/user.model';
import { throwError } from './app-helper';
import { Environment } from '../config/environment';
import { UserApiKeys } from '../modules/users/models/userApiKeys.model';

interface JWT {
  email: string;
  resourceId: string;
  Permission: [string];
  tokenVersion?: number;
}

interface JWTPayload {
  email: string;
  userId: string;
  companyId: string;
  tokenVersion?: number;
  tokenType?: 'access' | 'refresh';
  rememberMe?: boolean;
}

const detectPlatform = (request: FastifyRequest): 'web' | 'app' => {
  const headerPlatform = String(request.headers['x-platform'] || '')
    .toLowerCase()
    .trim();

  if (headerPlatform === 'web') return 'web';
  if (headerPlatform === 'mobile' || headerPlatform === 'app') return 'app';

  const userAgent = request.headers['user-agent'] || '';
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);

  return isMobile ? 'app' : 'web';
};

const getUserByEmail = async (email: string) => {
  const userByEmail = memoize(
    async function (email: string) {
      return await User.findOne(
        { email: { $regex: email, $options: 'i' }, isArchived: false, status: 1 },
        {
          email: 1,
          firstName: 1,
          lastName: 1,
          companyId: 1,
          isHSAdmin: 1,
          isAdmin: 1,
          profileCompletion: 1
        }
      );
    },
    { maxAge: ms('50s'), isPromise: true }
  );
  const user = await userByEmail(email);
  console.log('found user in memoize fn', user);
  if (user == null) {
    console.log('finding user in DB', user);
    return await User.findOne(
      { email: { $regex: email, $options: 'i' }, isArchived: false },
      {
        projection: {
          email: 1,
          firstName: 1,
          lastName: 1,
          companyId: 1,
          isHSAdmin: 1,
          isAdmin: 1,
          profileCompletion: 1
        }
      }
    );
  }

  return user;
};

async function verifyXSignature(signature: string): Promise<{ email: string } | null> {
  try {
    // Direct database lookup - no payload parsing needed
    const apiKeyRecord = await UserApiKeys.findOne({ 
      token: signature,
      isActive: true
    });

    if (!apiKeyRecord) {
      console.error('❌ Token not found in database or is inactive');
      return null;
    }

    // Check expiry time from database record
    const expiryDate = new Date(apiKeyRecord.expiryTime);
    const now = new Date();
    console.log('🔍 Expiry:', expiryDate.toISOString(), 'Now:', now.toISOString());
    
    if (expiryDate < now) {
      console.error('❌ Token expired');
      return null;
    }

    console.log('✅ Token verification successful for:', apiKeyRecord.userEmail);
    return { email: apiKeyRecord.userEmail };

  } catch (error: any) {
    console.error('❌ Error verifying signature:', error.message);
    return null;
  }
}

const validateToken = async (request: FastifyRequest) => {

  const platform = detectPlatform(request);
  const routeUrl = request.routeOptions?.url || request.url;

  // Check if this is sheets-webhook route
  const isSheetsWebhook = routeUrl.includes('/sheets-webhook');

  console.log('🔍 Is sheets webhook?', isSheetsWebhook);
  let user: any;

  if (isSheetsWebhook) {
    
    const signature = (request.headers['authorization'] as string || '').trim();
    if (!signature) {
      throw throwError(
        'Missing authorization header',
        { status: 401, payload: { reason: 'authorization header required' } },
        'REMOTE_UNAUTHORIZED'
      );
    }

    const decoded = await verifyXSignature(signature);
    if (!decoded) {
      throw throwError(
        'Invalid authorization',
        { status: 401, payload: { reason: 'Invalid or expired authorization' } },
        'REMOTE_UNAUTHORIZED'
      );
    }

    const { email } = decoded;
    const userDetails: any = await getUserByEmail(email);

    if (!userDetails?.email) {
      throw throwError(
        'User not found',
        { status: 401, payload: { reason: 'User is not allowed to access' } },
        'REMOTE_UNAUTHORIZED'
      );
    }

    user = {
      email: userDetails.email,
      userId: userDetails._id.toString(),
      companyId: userDetails.companyId?.toString() || '',
      isHSAdmin: userDetails.isHSAdmin || false,
      isAdmin: userDetails.isAdmin || false,
      profileCompletion: userDetails.profileCompletion || 0,
      isMobile: false, // sheets webhook is not mobile
      tokenVersion: 0
    };


  } else {
    // Use standard JWT authentication for other routes

    const token = request?.headers?.authorization?.split(' ')[1];
    if (!token) {
      throw new Error('Authorization token not found');
    }

    const jwt: JWT = await request.jwtVerify();
    const { email } = jwt;

    const userDetails: any = await getUserByEmail(email);

    if (!userDetails?.email) {
      throw throwError(
        'Login disabled',
        { status: 401, payload: { reason: 'User is not allowed to login' } },
        'REMOTE_UNAUTHORIZED'
      );
    }

    const userDetail = {
      email: userDetails?.email,
      userId: userDetails?._id,
      companyId: userDetails?.companyId,
      isHSAdmin: userDetails?.isHSAdmin,
      isAdmin: userDetails?.isAdmin,
      profileCompletion: userDetails?.profileCompletion
    };

    user = { 
      ...userDetail, 
      isMobile: platform === 'app' ? true : false, 
      tokenVersion: jwt.tokenVersion || 0 
    };
  }

  request.user = user;
  return user;
};

const verifyRefreshToken = async (refreshToken: string) => {
  try {
    const verifier = createVerifier({
      key: Environment.JWT_CONFIG.TOKEN_SECRET,
      algorithms: [Environment.JWT_CONFIG.ALGORITHM]
    });

    const jwt: any = verifier(refreshToken);
    console.log('Verified Refresh Token Payload:', jwt);

    if (jwt.iss !== Environment.JWT_CONFIG.ISSUER) {
      throw new Error('Invalid issuer');
    }

    if (jwt.tokenType !== 'refresh') {
      throw throwError(
        'Invalid token type',
        { status: 401, payload: { code: 'INVALID_TOKEN_TYPE' } },
        'INVALID_TOKEN_TYPE'
      );
    }
    return jwt;
  } catch (err: any) {
    if (err.code === 'FAST_JWT:EXPIRED') {
      throwError('Refresh token expired', { status: 401 });
    } else {
      throwError('Invalid refresh token', { status: 401 });
    }
  }
};

const generateToken = async (user: any) => {
  const payload: JWTPayload = {
    email: user.email,
    userId: user._id || user.userId,
    companyId: user.companyId,
    tokenVersion: user.tokenVersion || 0,
    tokenType: 'access'
  };

  const signSync = createSigner({
    key: Environment.JWT_CONFIG.TOKEN_SECRET,
    expiresIn: Environment.JWT_CONFIG.ACCESS_TOKEN_EXPIRES_IN,
    iss: Environment.JWT_CONFIG.ISSUER,
    algorithm: Environment.JWT_CONFIG.ALGORITHM
  });

  const token = signSync(payload);
  console.log('Your JWT is: ');
  console.log('Bearer', token);
  return token;
};

const generateRefreshToken = async (user: any, rememberMe: boolean = false) => {
  const payload: JWTPayload = {
    email: user.email,
    userId: user._id || user.userId,
    companyId: user.companyId,
    tokenVersion: user.tokenVersion || 0,
    tokenType: 'refresh',
    rememberMe
  };

  const refreshExpiresIn = rememberMe
    ? Environment.JWT_CONFIG.LONG_REFRESH_TOKEN_EXPIRES_IN
    : Environment.JWT_CONFIG.REFRESH_TOKEN_EXPIRES_IN;

  const signSync = createSigner({
    key: Environment.JWT_CONFIG.TOKEN_SECRET,
    expiresIn: refreshExpiresIn,
    iss: Environment.JWT_CONFIG.ISSUER,
    algorithm: Environment.JWT_CONFIG.ALGORITHM
  });

  const token = signSync(payload);
  console.log('Your JWT is: ');
  console.log('Bearer', token);
  return token;
};

export { validateToken, generateToken, generateRefreshToken, verifyRefreshToken };