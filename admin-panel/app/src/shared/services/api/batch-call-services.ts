import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';

//Base service
import { BaseApiService } from './base-service';

@Injectable({ providedIn: 'root' })
export class BatchCallService extends BaseApiService {
  constructor(@Inject(HttpClient) private _http: HttpClient) {
    super(_http, 'batch-call');
  }

  listing(filter?: any) {
    return this.get(`listing`, filter);
  }

  create(payload: any) {
    return this.post('upload', payload);
  }

  statusUpdate(id: any, payload: any) {
    return this.put(`start-call/${id}`, payload);
  }

  filterListing(filter?: any) {
    return this.get(`batch-listing`, filter);
  }

  details(payload: any) {
    return this.post(`details`, payload);
  }

  deleteCall(filter: any) {
    return this.delete(`delete/${filter._id}/${filter.type}`);
  }

  createFromCalls(payload: any) {
    return this.post(`calls-from-dashboard`, payload);
  }

  updateBatchCall(payload: any) {
    return this.post(`retry-batch-call`, payload);
  }

  updateFollowupCall(payload: any) {
    return this.post(`retry-followups-batch-call`, payload);
  }

  pendingProcessBatchCall(payload: any) {
    return this.post(`process-pending-batch-call`, payload);
  }

  markbatchCompleted(payload: any) {
    return this.post(`mark-complete-batch-call`, payload);
  }

  retrybatchCallCompleted(payload: any) {
    return this.post(`mark-complete-batch-call`, payload);
  }
}
