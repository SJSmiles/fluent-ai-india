import { Server } from '../../../server';
import { CallService } from '../service/call.service';
import RetellService from '../service/retall.service';

const CallServiceInstance = new CallService();

export async function retellCallListingHandler(request: any) {
  try {
    return CallServiceInstance.getCallListingFromRetell(request.user, request.query);
  } catch (err) {
    Server.log.error(err, 'Error in callListingHandler');
    throw err;
  }
}

export async function callListingHandler(request: any) {
  try {
    return CallServiceInstance.getCallListing(request.user, request.query);
  } catch (err) {
    Server.log.error(err, 'Error in callListingHandler');
    throw err;
  }
}

export async function groupedCallListingHandler(request: any) {
  try {
    return CallServiceInstance.getGroupedCallListing(request.user, request.query);
  } catch (err) {
    Server.log.error(err, 'Error in groupedCallListingHandler');
    throw err;
  }
}

export async function callDetailHandler(request: any) {
  try {
    return CallServiceInstance.detail(request.user, request.query);
  } catch (err) {
    Server.log.error(err, 'Error in callDetailHandler');
    throw err;
  }
}

export async function exportCallListingHandler(request: any, reply: any) {
  try {
    const buffer = await CallServiceInstance.exportCallListing(request.user, request.query);

    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', 'attachment; filename="call_export.xlsx"')
      .send(buffer);
  } catch (err) {
    Server.log.error(err, 'Error in export call listing Handler');
  }
}
export async function retellCallCreateHandler(request: any) {
  try {
    return RetellService.createRetellCall(request.user, request.body);
  } catch (err) {
    Server.log.error(err, 'Error in callListingHandler');
    throw err;
  }
}

export async function updateCallLeadStatusHandler(request: any, reply: any): Promise<any> {
  try {
    return CallServiceInstance.updateCallLeadStatus(request.user, request.body);
  } catch (err) {
    Server.log.error(err, 'Error in updateCallLeadStatusHandler');
    return reply.code(500).send({
      message: 'Internal server error',
      data: null,
      success: false
    });
  }
}

export async function phoneDetailPostHandler(request: any) {
  try {
    const payload = {
      phoneNumber: request.body.phoneNumber,
      userId: request.user.userId,
      companyId: request.body.companyId,
      targetUserId: request.body.userId,
      skip: request.body.skip,
      limit: request.body.limit
    };
    
    const startDate = request.body.startDate;
    const endDate = request.body.endDate;
    
    console.log('📥 Handler received dates:', { startDate, endDate });
    
    return CallServiceInstance.getPhoneDetail(
      request.user, 
      payload, 
      startDate, 
      endDate
    );
  } catch (err) {
    Server.log.error(err, 'Error in phoneDetailPostHandler');
    throw err;
  }
}

