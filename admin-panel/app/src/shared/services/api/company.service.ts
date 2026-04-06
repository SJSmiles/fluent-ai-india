import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';

//Base service
import { BaseApiService } from './base-service';

@Injectable({ providedIn: 'root' })
export class CompanyService extends BaseApiService {
  constructor(@Inject(HttpClient) private _http: HttpClient) {
    super(_http, 'companies');
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

  getCountryMasterList() {
    return this.get(`country-master-list`);
  }

  getCompanyFilterList() {
    return this.get(`company-filter-list`);
  }

  toggleStatus(payload: any) {
    return this.put('toggle-status', payload);
  }

  generateCompanyToken(payload?: any) {
    return this.post(`generate-token`, payload);
  }
}
