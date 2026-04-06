import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';

//Base service
import { BaseApiService } from './base-service';

@Injectable({ providedIn: 'root' })
export class TemplateService extends BaseApiService {
  constructor(@Inject(HttpClient) private _http: HttpClient) {
    super(_http, 'message-templates');
  }

  create(payload: any) {
    return this.post('create', payload);
  }

  update(payload: any) {
    return this.put('update', payload);
  }

  toggleStatus(payload: any) {
    return this.put('change-status', payload);
  }

  listing(filter?: any) {
    return this.get(`listing`, filter);
  }

  filterListing(filter?: any) {
    return this.get(`filter-list`, filter);
  }
}
