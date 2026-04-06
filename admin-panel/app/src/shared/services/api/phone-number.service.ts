import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

//Base service
import { BaseApiService } from './base-service';

@Injectable({ providedIn: 'root' })
export class PhoneNumberService extends BaseApiService {
    constructor(@Inject(HttpClient) private _http: HttpClient) {
        super(_http, 'phone-number');
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

    filterListing(filter?: any) {
        return this.get(`filter-list`, filter);
    }
}
