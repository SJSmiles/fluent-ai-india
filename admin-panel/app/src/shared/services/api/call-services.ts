import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';

//Base service
import { BaseApiService } from './base-service';

@Injectable({ providedIn: 'root' })
export class CallService extends BaseApiService {
  constructor(@Inject(HttpClient) private _http: HttpClient) {
    super(_http, 'calls');
  }

  listing(filter?: any) {
    return this.get(`listing`, filter);
  }

  groupListing(filter?: any) {
    return this.get(`grouped-listing`, filter);
  }

  markAsRead(payload?: any) {
    return this.put(`comments/mark-read`, payload);
  }

  exportCall(filter: any) {
    return this.get('export', filter, { responseType: 'blob' });
  }

  details(id: string) {
    return this.get(`detail?id=${id}`);
  }

  phoneDetails(payload?: any) {
    return this.post(`phone-detail`, payload);
  }

  statusUpdate(payload: any) {
    return this.put(`update-leadStatus`, payload);
  }

  createComment(payload?: any) {
    return this.post(`comments/create`, payload);
  }

  getCommentList(payload?: any) {
    return this.get(`comments/list`, payload);
  }

  markCommentAsRead(payload?: any) {
    return this.put(`comments/mark-read`, payload);
  }
}
