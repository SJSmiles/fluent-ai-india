import { Server } from '../../../server';
import { CommentService } from '../service/comment.service';

const CommentServiceInstance = new CommentService();

export async function createCommentHandler(request: any, reply: any): Promise<any> {
  try {
    const result = await CommentServiceInstance.createComment(request.user, request.body);
    
    if (!result.success) {
      return reply.code(400).send(result);
    }
    
    return reply.code(201).send(result);
  } catch (err) {
    Server.log.error(err, 'Error in createCommentHandler');
    return reply.code(500).send({
      message: 'Internal server error',
      data: null,
      success: false
    });
  }
}

export async function listCommentsHandler(request: any, reply: any): Promise<any> {
  try {
    console.log('Request user:', request.user);
    console.log('Request query:', request.query);
    
    const result = await CommentServiceInstance.getComments(request.user, request.query);
    
    console.log('Result:', result);
    
    if (!result.success) {
      return reply.code(400).send(result);
    }
    
    return reply.code(200).send(result);
  } catch (err) {
    Server.log.error(err, 'Error in listCommentsHandler');
    return reply.code(500).send({
      message: 'Internal server error',
      data: null,
      success: false
    });
  }
}

export async function markAsReadHandler(request: any, reply: any): Promise<any> {
  try {
    console.log('📝 markAsReadHandler called');
    console.log('User from token:', {
      userId: request.user.userId,
      companyId: request.user.companyId
    });
    console.log('Request body:', request.body);  // Will contain { phone: "..." }

    const result = await CommentServiceInstance.markAsRead(request.user, request.body);
    
    if (!result.success) {
      return reply.code(400).send(result);
    }
    
    return reply.code(200).send(result);
  } catch (err) {
    Server.log.error(err, 'Error in markAsReadHandler');
    return reply.code(500).send({
      message: 'Internal server error',
      data: null,
      success: false
    });
  }
}