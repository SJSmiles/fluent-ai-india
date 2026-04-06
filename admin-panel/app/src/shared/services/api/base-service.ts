import { Injectable } from '@angular/core';
import { HttpClient, HttpParameterCodec, HttpParams } from '@angular/common/http';
import { environment } from 'app/src/environments/environment';

@Injectable({
  providedIn: 'root'
})
class CustomHttpParamEncoder implements HttpParameterCodec {
  encodeKey(key: string): string {
    return encodeURIComponent(key);
  }
  encodeValue(value: string): string {
    return encodeURIComponent(value).replace(/%2B/g, '+');
  }
  decodeKey(key: string): string {
    return decodeURIComponent(key);
  }
  decodeValue(value: string): string {
    return decodeURIComponent(value);
  }
}
export class BaseApiService {
  constructor(
    protected http: HttpClient,
    protected baseURL: String
  ) {}

  getApiUrl(basePath: any) {
    return environment.apiUrl + basePath;
  }
  post(route = '', postData = {}, headers = {}) {
    return this.http.post<any>(`${environment.apiUrl}/${this.baseURL}/${route}`, postData, headers);
  }

  put(route = '', putData = {}) {
    return this.http.put<any>(`${environment.apiUrl}/${this.baseURL}/${route}`, putData);
  }

  get(route: any, params?: any, options?: any) {
    let url = `${environment.apiUrl}/${this.baseURL}/`;
    if (route === '') {
      url = `${environment.apiUrl}/${this.baseURL}`;
    }
    options = options || {};
    if (params) {
      options.params = params;
      options.params = new HttpParams({
        encoder: new CustomHttpParamEncoder()
      });
      Object.keys(params).forEach((key) => {
        options.params = options.params.set(key, params[key]);
      });
    }

    return this.http.get<any>(`${url}${route}`, options);
  }

  delete(route: any, params?: any, options?: any) {
    let url = `${environment.apiUrl}/${this.baseURL}/`;
    if (route === '') {
      url = `${environment.apiUrl}/${this.baseURL}`;
    }
    return this.http.delete<any>(`${url}${route}`, { params, ...options });
  }

  getResourceFromServer(route: any, params?: any) {
    let url = `${environment.apiUrl}/${this.baseURL}/`;
    if (route === '') {
      url = `${environment.apiUrl}/${this.baseURL}`;
    }
    return this.http.get(`${url}${route}`, { params });
  }
}
