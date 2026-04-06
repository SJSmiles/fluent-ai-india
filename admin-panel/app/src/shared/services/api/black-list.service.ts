import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BaseApiService } from './base-service';

@Injectable({
  providedIn: 'root'
})
export class BlackListService extends BaseApiService {
  constructor(@Inject(HttpClient) private _http: HttpClient) {
    super(_http, 'black-list');
  }

  getListing(params: any) {
    return this.get('listing', params);
  }

  deleteRecord(id: any) {
    return this.put(`un-black-list/${id}`);
  }
}
