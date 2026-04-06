import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BaseApiService } from './base-service';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsCallService extends BaseApiService {
  constructor(@Inject(HttpClient) private _http: HttpClient) {
    super(_http, 'analytics');
  }

  getAnalyticsCount(params: any) {
    return this.get('dashboard/count', params);
  }
}
