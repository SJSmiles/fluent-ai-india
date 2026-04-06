import { AppModule } from '../../common/common-interfaces';
import { listBlackListHandler, removeBlackListHandler } from './handler/black-list.handler';
import { listBlackListRequest, removeBlackListRequest } from './schema/black-list.schema';


export const module: AppModule = {
    name: 'Blacklist Number',
    mountPoint: '/black-list',
    auth: true,
    routes: [
        {
            method: 'GET',
            url: '/listing',
            auth: true,
            schema: listBlackListRequest,
            handler: listBlackListHandler
        },
        {
            method: 'PUT',
            url: '/un-black-list/:id',
            auth: true,
            schema: removeBlackListRequest,
            handler: removeBlackListHandler
        }
    ]
}