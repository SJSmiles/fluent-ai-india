import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';

//Base service
import { BaseApiService } from './base-service';

@Injectable({ providedIn: 'root' })
export class ContactService extends BaseApiService {
  constructor(@Inject(HttpClient) private _http: HttpClient) {
    super(_http, 'contacts');
  }

  create(payload: any) {
    return this.post('create', payload);
  }

  update(payload: any) {
    return this.put('update', payload);
  }

  listing(filter?: any) {
    return this.get(`listing`, filter);
  }

  deleteContact(payload: any) {
    return this.delete('delete', payload);
  }

  uploadContacts(payload: any) {
    return this.post('upload', payload);
  }


  exportCall(filter: any) {
    return this.get('export', filter, { responseType: 'blob' });
  }
}