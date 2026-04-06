import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';

//Base service
import { BaseApiService } from './base-service';

@Injectable({ providedIn: 'root' })
export class UserService extends BaseApiService {
  constructor(@Inject(HttpClient) private _http: HttpClient) {
    super(_http, 'users');
  }

  loginUser(filter: any) {
    return this.post('login', filter);
  }

  registerUser(filter: any) {
    return this.post('registration', filter);
  }

  create(payload: any) {
    return this.post('create', payload);
  }

  update(payload: any) {
    return this.put('update', payload);
  }

  refreshToken() {
    return this.post('refresh-token');
  }

  getCurrentUser() {
    return this.get('getCurrentUser');
  }

  listing(filter?: any) {
    return this.get(`listing`, filter);
  }

  filterListing(filter?: any) {
    return this.get(`filter-list`, filter);
  }

  changePassword(filter: any) {
    return this.post('change-password', filter);
  }

  signatureListing(filter?: any) {
    return this.get(`x-signature-list`, filter);
  }

  generateToken(payload: any) {
    return this.post('x-signature', payload);
  }

  inactiveToken(payload: any) {
    return this.post('inactive-x-signature', payload);
  }

  toggleStatus(payload: any) {
    return this.put('toggle-status', payload);
  }
}
