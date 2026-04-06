import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';

//Base service
import { BaseApiService } from './base-service';

@Injectable({ providedIn: 'root' })
export class AgentService extends BaseApiService {
  constructor(@Inject(HttpClient) private _http: HttpClient) {
    super(_http, 'agents');
  }

  filterListing(filter?: any) {
    return this.get(`filter-list`, filter);
  }

  listing(filter?: any) {
    return this.get(`listing`, filter);
  }

  agentListing(filter?: any) {
    return this.get(`agent-listing`, filter);
  }

  agentDetails(filter?: any) {
    return this.post(`agent-details`, filter);
  }

  agentPrompt(filter?: any) {
    return this.post(`agent-prompt`, filter);
  }

  customUpdate(id: string, payload: any) {
    return this.put(`custom-update/${id}`, payload);
  }

  pullAgent(filter?: any) {
    return this.post(`pull`, filter);
  }

  allAgentsList(filter?: any) {
    return this.get(`all-agents`, filter);
  }

  saveMappings(payload?: any) {
    return this.post(`user-agents-map`, payload);
  }

  updateAgent(payload: any) {
    return this.put(`update-agent-phone`, payload);
  }

  getCurrentMappedAgents(filter?: any) {
    return this.get(`current-mappings`, filter);
  }

  setPrimaryAgent(payload: any) {
    return this.post(`set-primary`, payload);
  }

  updatePrompt(id: string, payload: any) {
    return this.put(`update-prompt/${id}`, payload);
  }
}
