import { MessageTemplate } from '../models/message-template.model';
import { Messages } from '../models/messages.model';
import { throwError } from '../../../common/app-helper';
import { Types } from 'mongoose';
import { Server } from '../../../server';

export class MessageTemplateService {

  /**
   * Create Message Template
   */
  async createTemplate(user: any, body: any) {
    try {
      const { companyId, userId, _id } = user;
      const currentUserId = userId || _id;

      if (!body.name || !body.name.trim()) {
        throw throwError('Template name is required', { status: 400 }, 'MISSING_NAME');
      }

      if (!body.message || !body.message.trim()) {
        throw throwError('Template message is required', { status: 400 }, 'MISSING_MESSAGE');
      }

      // Prevent duplicate template name per company
      const existingTemplate = await MessageTemplate.findOne({
        companyId: new Types.ObjectId(companyId),
        name: body.name.trim(),
        isArchived: false
      });

      if (existingTemplate) {
        throw throwError(
          'Template with this name already exists',
          { status: 409 },
          'DUPLICATE_TEMPLATE_NAME'
        );
      }

      const newTemplate = new MessageTemplate({
        name: body.name.trim(),
        message: body.message.trim(),
        isActive: body.isActive !== undefined ? body.isActive : true,
        companyId: new Types.ObjectId(companyId),
        createdBy: new Types.ObjectId(currentUserId)
      });

      await newTemplate.save();

      Server.log.info(
        { templateId: newTemplate._id },
        '✅ Message template created successfully'
      );

      return {
        success: true,
        message: 'Message template created successfully',
        data: newTemplate
      };
    } catch (error: any) {
      Server.log.error(error, '❌ Error in createTemplate');
      throw error;
    }
  }

  /**
   * Get Template List
   */
  async getTemplateList(user: any, query: any) {
    try {
      const { companyId } = user;

      const {
        skip = 0,
        limit = 10,
        search = '',
        sortBy = 'createdAt desc',
        isActive
      } = query;

      let filter: any = {
        companyId: new Types.ObjectId(companyId),
        isArchived: false
      };

      if (typeof isActive === 'boolean') {
        filter.isActive = isActive;
      }

      if (search && search.trim()) {
        filter.$or = [
          { name: { $regex: search.trim(), $options: 'i' } },
          { message: { $regex: search.trim(), $options: 'i' } }
        ];
      }

      // Sorting
      const sort: any = {};
      const sortParts = sortBy.split(' ');
      sort[sortParts[0]] = sortParts[1]?.toLowerCase() === 'asc' ? 1 : -1;

      const [templates, total] = await Promise.all([
        MessageTemplate.find(filter)
          .populate('createdBy', 'firstName lastName email')
          .sort(sort)
          .skip(Number(skip))
          .limit(Number(limit))
          .lean(),
        MessageTemplate.countDocuments(filter)
      ]);

      return {
        success: true,
        message: 'Templates retrieved successfully',
        data: {
          templates,
          total,
          skip: Number(skip),
          limit: Number(limit)
        }
      };
    } catch (error: any) {
      Server.log.error(error, '❌ Error in getTemplateList');
      throw error;
    }
  }

  /**
   * Get Active Template Filter List
   */
  async getTemplateFilterListing(user: any) {
    try {
      const { companyId } = user;

      const templates = await MessageTemplate.find({
        companyId: new Types.ObjectId(companyId),
        isArchived: false,
        isActive: true
      })
        .select('name message _id')
        .lean();

      return {
        success: true,
        message: 'Active templates retrieved successfully',
        data: templates
      };
    } catch (error: any) {
      Server.log.error(error, '❌ Error in getTemplateFilterListing');
      throw error;
    }
  }

  /**
   * Update Template
   */
  async updateTemplate(user: any, body: any) {
    try {
      const { companyId, userId, _id, isAdmin } = user;
      const currentUserId = userId || _id;

      if (!body._id) {
        throw throwError('Template ID is required', { status: 400 }, 'MISSING_TEMPLATE_ID');
      }

      const template = await MessageTemplate.findOne({
        _id: new Types.ObjectId(body._id),
        companyId: new Types.ObjectId(companyId),
        isArchived: false
      });

      if (!template) {
        throw throwError('Template not found', { status: 404 }, 'TEMPLATE_NOT_FOUND');
      }

      const updateData: any = {};

      if (body.name && body.name.trim()) {
        // Check duplicate name
        const existing = await MessageTemplate.findOne({
          companyId: template.companyId,
          name: body.name.trim(),
          _id: { $ne: template._id },
          isArchived: false
        });

        if (existing) {
          throw throwError(
            'Another template with this name already exists',
            { status: 409 },
            'DUPLICATE_TEMPLATE_NAME'
          );
        }

        updateData.name = body.name.trim();
      }

      if (body.message) {
        updateData.message = body.message.trim();
      }

      if (body.hasOwnProperty('isActive')) {
        updateData.isActive = body.isActive;
      }

      updateData.updatedBy = new Types.ObjectId(currentUserId);

      const updatedTemplate = await MessageTemplate.findByIdAndUpdate(
        template._id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      Server.log.info(
        { templateId: template._id },
        '✅ Template updated successfully'
      );

      return {
        success: true,
        message: 'Template updated successfully',
        data: updatedTemplate
      };
    } catch (error: any) {
      Server.log.error(error, '❌ Error in updateTemplate');
      throw error;
    }
  }

  /**
   * Delete Template (Soft Delete)
   */
  async deleteTemplate(user: any, body: any) {
    try {
      const { companyId, userId, _id } = user;
      const currentUserId = userId || _id;

      if (!body._id) {
        throw throwError('Template ID is required', { status: 400 }, 'MISSING_TEMPLATE_ID');
      }

      const template = await MessageTemplate.findOne({
        _id: new Types.ObjectId(body._id),
        companyId: new Types.ObjectId(companyId),
        isArchived: false
      });

      if (!template) {
        throw throwError('Template not found', { status: 404 }, 'TEMPLATE_NOT_FOUND');
      }

      await MessageTemplate.findByIdAndUpdate(template._id, {
        $set: {
          isArchived: true,
          updatedBy: new Types.ObjectId(currentUserId)
        }
      });

      Server.log.info(
        { templateId: template._id },
        '✅ Template archived successfully'
      );

      return {
        success: true,
        message: 'Template deleted successfully'
      };
    } catch (error: any) {
      Server.log.error(error, '❌ Error in deleteTemplate');
      throw error;
    }
  }

  /**
   * Get Single Template
   */
  async getSingleTemplate(user: any, templateId: string) {
    try {
      const { companyId } = user;

      const template = await MessageTemplate.findOne({
        _id: new Types.ObjectId(templateId),
        companyId: new Types.ObjectId(companyId),
        isArchived: false
      }).lean();

      if (!template) {
        throw throwError('Template not found', { status: 404 }, 'TEMPLATE_NOT_FOUND');
      }

      return {
        success: true,
        message: 'Template retrieved successfully',
        data: template
      };
    } catch (error: any) {
      Server.log.error(error, '❌ Error in getSingleTemplate');
      throw error;
    }
  }

  async updateStatusTemplate(user: any, body: any) {
    try {
      const { companyId, userId, _id, isAdmin } = user;
      const currentUserId = userId || _id;

      if (!body._id) {
        throw throwError('Template ID is required', { status: 400 }, 'MISSING_TEMPLATE_ID');
      }

      const template = await MessageTemplate.findOne({
        _id: new Types.ObjectId(body._id),
        companyId: new Types.ObjectId(companyId),
        isArchived: false
      });

      if (!template) {
        throw throwError('Template not found', { status: 404 }, 'TEMPLATE_NOT_FOUND');
      }

      const updateData: any = {};


      if (body.hasOwnProperty('isActive')) {
        updateData.isActive = body.isActive;
      }

      updateData.updatedBy = new Types.ObjectId(currentUserId);

      const updatedTemplate = await MessageTemplate.findByIdAndUpdate(
        template._id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      Server.log.info(
        { templateId: template._id },
        '✅ Template status updated successfully'
      );

      return {
        success: true,
        message: 'Template status updated successfully',
        data: updatedTemplate
      };
    } catch (error: any) {
      Server.log.error(error, '❌ Error in updateStatusTemplate');
      throw error;
    }
  }


  async getMessageList(user: any, query: any) {
    try {

      const { senderId, toNumber, skip = 0, limit = 100 } = query;
      let filter: any = {
        senderId: senderId ? new Types.ObjectId(senderId) : user?.userId
      };
      if (!user?.isHSAdmin) {
        filter.companyId = new Types.ObjectId(user?.companyId);
      }


      if (toNumber) {
        const normalizedNumber = toNumber.startsWith('+') ? toNumber : `+${toNumber}`;
        filter.toNumber = normalizedNumber;
      }

      const [messages, total] = await Promise.all([
        Messages.find(filter)
          .sort({ updatedAt: -1 }) // latest on top
          .skip(Number(skip))
          .limit(Number(limit))
          .lean(),

        Messages.countDocuments(filter)
      ]);

      return {
        success: true,
        message: 'Messages retrieved successfully',
        data: {
          messages,
          total,
          skip: Number(skip),
          limit: Number(limit)
        }
      };

    } catch (error: any) {
      Server.log.error(error, '❌ Error in getMessageList');
      throw error;
    }
  }
}
