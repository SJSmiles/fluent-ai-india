import { Types } from 'mongoose';
import { Comment } from '../models/comment.model';
import {
  ICommentCreatePayload,
  ICommentListPayload,
  ICommentResponse,
  IMarkAsReadPayload
} from '../interface/comment.interface';

export class CommentService {
  /**
   * Create a new comment
   */
  async createComment(user: any, payload: ICommentCreatePayload): Promise<ICommentResponse> {
    try {
      const { phone, comment, callId } = payload;

      // Validate phone number format (basic validation)
      if (!phone || phone.trim().length === 0) {
        return {
          message: 'Phone number is required',
          data: null,
          success: false
        };
      }

      // Validate comment text
      if (!comment || comment.trim().length === 0) {
        return {
          message: 'Comment text is required',
          data: null,
          success: false
        };
      }

      // Clean and normalize phone number
      let cleanPhone = phone.trim();
      if (!cleanPhone.startsWith('+')) {
        cleanPhone = '+' + cleanPhone;
      }

      console.log('Creating comment with user:', user);

      const commentData = {
        phone: cleanPhone,
        companyId: new Types.ObjectId(user.companyId),
        createdBy: new Types.ObjectId(user.userId),
        comment: comment.trim(),
        readBy: [new Types.ObjectId(user.userId)],
        ...(callId && { callId: new Types.ObjectId(callId) })
      };

      console.log('Comment data to create:', commentData);

      const newComment = await Comment.create(commentData);

      // Populate user details
      const populatedComment = await Comment.findById(newComment._id)
        .populate({
          path: 'createdBy',
          select: 'firstName lastName email',
          strictPopulate: false
        })
        .lean();

      return {
        message: 'Comment created successfully',
        data: populatedComment,
        success: true
      };
    } catch (error: any) {
      console.error('Error in createComment:', error);
      return {
        message: error.message || 'Failed to create comment',
        data: null,
        success: false
      };
    }
  }

  /**
   * Get comments for a specific phone number
   */
  async getComments(user: any, payload: ICommentListPayload): Promise<ICommentResponse> {
    try {
      const { phone, skip = 0, limit = 20, sortBy = '-createdAt' } = payload;

      if (!phone || phone.trim().length === 0) {
        return {
          message: 'Phone number is required',
          data: null,
          success: false
        };
      }

      // Clean and normalize phone number - remove spaces and ensure + prefix
      let cleanPhone = phone.trim();
      if (!cleanPhone.startsWith('+')) {
        cleanPhone = '+' + cleanPhone;
      }

      // Build query - only show comments from same company
      const query: any = {
        phone: cleanPhone,
        companyId: new Types.ObjectId(user.companyId)
      };

      console.log('Query for comments:', query);
      console.log('User companyId:', user.companyId);

      // Get total count
      const totalCount = await Comment.countDocuments(query);
      
      console.log('Total comments found:', totalCount);

      // Fetch comments with pagination
      const comments = await Comment.find(query)
        .populate({
          path: 'createdBy',
          select: 'firstName lastName email',
          strictPopulate: false
        })
        .sort(sortBy)
        .skip(Number(skip))
        .limit(Number(limit))
        .lean();

      console.log('Comments fetched:', comments.length);

      // Add isRead flag for current user
      const commentsWithReadStatus = comments.map((comment: any) => ({
        ...comment,
        isReadByCurrentUser: comment.readBy.some(
          (id: Types.ObjectId) => id.toString() === user.userId.toString()
        ),
        readCount: comment.readBy.length,
        createdBy: comment.createdBy || {
          firstName: 'Unknown',
          lastName: 'User',
          email: ''
        }
      }));

      return {
        message: 'Comments retrieved successfully',
        data: commentsWithReadStatus,
        success: true,
        totalCount
      };
    } catch (error: any) {
      console.error('Error in getComments:', error);
      return {
        message: error.message || 'Failed to retrieve comments',
        data: null,
        success: false
      };
    }
  }

  /**
   * Mark a comment as read by current user
   */
  async markAsRead(user: any, payload: IMarkAsReadPayload): Promise<ICommentResponse> {
  try {
    const { phone } = payload;

    if (!phone || phone.trim().length === 0) {
      return {
        message: 'Phone number is required',
        data: null,
        success: false
      };
    }

    // Clean and normalize phone number
    let cleanPhone = phone.trim();
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = '+' + cleanPhone;
    }

    // ✅ Get user ID from token
    const userId = user.userId instanceof Types.ObjectId 
      ? user.userId 
      : new Types.ObjectId(user.userId);
    
    console.log('🔍 Marking comments as read for phone:', cleanPhone);
    console.log('🔍 User ID:', userId.toString());
    console.log('🔍 Company ID:', user.companyId?.toString());

    // ✅ Find all comments for this phone number in user's company where user hasn't read yet
    const unreadComments = await Comment.find({
      phone: cleanPhone,
      companyId: new Types.ObjectId(user.companyId),
      readBy: { $ne: userId }  // Only comments NOT read by this user
    })
      .select('_id')
      .lean();

    console.log(`📝 Found ${unreadComments.length} unread comments for ${cleanPhone}`);

    if (unreadComments.length === 0) {
      return {
        message: 'No unread comments to mark as read',
        data: null,
        success: true
      };
    }

    // ✅ Update all unread comments in one query - add user to readBy array
    const commentIds = unreadComments.map(comment => comment._id);
    
    const updateResult = await Comment.updateMany(
      {
        _id: { $in: commentIds },
        companyId: new Types.ObjectId(user.companyId)
      },
      {
        $addToSet: { readBy: userId }
      }
    );

    console.log(`✅ Marked ${updateResult.modifiedCount} comments as read`);

    return {
      message: `Marked ${updateResult.modifiedCount} comments as read`,
      data: {
        markedCount: updateResult.modifiedCount,
        phone: cleanPhone
      },
      success: true
    };
  } catch (error: any) {
    console.error('Error in markAsRead:', error);
    return {
      message: error.message || 'Failed to mark comments as read',
      data: null,
      success: false
    };
  }
}

  /**
   * Get unread comment count for a phone number
   */
  async getUnreadCount(user: any, phone: string): Promise<number> {
    try {
      const count = await Comment.countDocuments({
        phone: phone.trim(),
        companyId: new Types.ObjectId(user.companyId),
        readBy: { $ne: new Types.ObjectId(user._id) }
      });

      return count;
    } catch (error) {
      console.error('Error in getUnreadCount:', error);
      return 0;
    }
  }
}