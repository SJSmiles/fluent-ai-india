import { Component, EventEmitter, Input, OnInit, Output, OnDestroy } from '@angular/core';
import { AppComponent } from 'app/app.component';
import { FluentAdminAppComponent } from 'app/src/core/shared-component';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { UserService } from 'app/src/shared/services';
import { AgentService } from 'app/src/shared/services/api/agent.services';
import { environment } from 'app/src/environments/environment';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  role?: string;
}

interface Agent {
  _id: string;
  agentName: string;
  agentId?: string;
  name?: string;
  voiceProvider?: string;
  userId?: string[];
  webhookUrl?: string | null;
}

interface UserAgentMapping {
  userId: string;
  agentIds: string[];
}

@Component({
  selector: 'app-agent-mapping',
  templateUrl: './agent-mapping.component.html',
  styleUrls: ['./agent-mapping.component.scss']
})
export class AgentMappingComponent extends FluentAdminAppComponent implements OnInit, OnDestroy {
  @Input() selectedCompanyData: any;
  @Output() mappingComplete = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  // Lists
  usersList: User[] = [];
  agentsList: Agent[] = [];
  filteredUsers: User[] = [];
  filteredAgents: Agent[] = [];

  // Search terms
  userSearchTerm: string = '';
  agentSearchTerm: string = '';

  // Selection states
  selectedUsers: string[] = [];
  userAgentMappings: UserAgentMapping[] = [];
  selectAllUsersChecked: boolean = false;
  selectAllAgentsChecked: boolean = false;

  // Loading states
  isLoadingUsers: boolean = false;
  isLoadingAgents: boolean = false;

  copiedIndex: string | null = null;

  constructor(
    private appComponent: AppComponent,
    private _userService: UserService,
    private _agentService: AgentService
  ) {
    super(appComponent);
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadData(): Promise<void> {
    if (!this.selectedCompanyData?._id) {
      this.showErrorToast('Company ID is required');
      return;
    }

    this.isLoadingUsers = true;
    this.isLoadingAgents = true;

    try {
      await Promise.all([this.loadUsers(), this.loadAgents()]);

      await this.loadCurrentMappings();
    } catch (error) {
      this.showErrorToast('Error loading data');
      console.error('Load data error:', error);
    } finally {
      this.isLoadingUsers = false;
      this.isLoadingAgents = false;
    }
  }

  loadUsers(): any {
    const filterPayload = {
      companyId: this.selectedCompanyData._id,
      skip: 0,
      limit: 1000
    };

    return new Promise((resolve, reject) => {
      this._userService
        .filterListing(filterPayload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: any) => {
            this.usersList = response?.data || [];
            this.filteredUsers = [...this.usersList];
            resolve(true);
          },
          error: (error) => {
            this.showErrorToast(`Error loading users: ${error?.error?.message || 'Unknown error'}`);
            this.usersList = [];
            this.filteredUsers = [];
            reject(error);
          }
        });
    });
  }

  loadAgents(): any {
    return new Promise((resolve, reject) => {
      const payload = {
        companyId: this.selectedCompanyData._id
      };
      this._agentService
        .allAgentsList(payload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: any) => {
            this.agentsList = response?.data || [];
            this.filteredAgents = [...this.agentsList];
            resolve(true);
          },
          error: (error) => {
            this.showErrorToast(
              `Error loading agents: ${error?.error?.message || 'Unknown error'}`
            );
            this.agentsList = [];
            this.filteredAgents = [];
            reject(error);
          }
        });
    });
  }

  loadCurrentMappings(): any {
    return new Promise((resolve, reject) => {
      const params = {
        companyId: this.selectedCompanyData._id
      };

      this._agentService
        .getCurrentMappedAgents(params)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: any) => {
            this.buildMappingsFromCurrentData(response?.data || []);
            resolve(true);
          },
          error: (error) => {
            console.error('Error loading current mappings:', error);
            // Don't show error toast, just resolve with empty mappings
            this.userAgentMappings = [];
            resolve(true);
          }
        });
    });
  }

  buildMappingsFromCurrentData(currentAgents: any[]): void {
    this.userAgentMappings = [];

    if (!currentAgents || currentAgents.length === 0) {
      // console.log('No current mappings found');
      return;
    }

    currentAgents.forEach((agent) => {
      if (Array.isArray(agent.userId) && agent.userId.length > 0) {
        agent.userId.forEach((userId: string) => {
          const userExists = this.usersList.some((u) => u._id === userId);
          if (!userExists) return;

          let mapping = this.userAgentMappings.find((m) => m.userId === userId);
          if (!mapping) {
            mapping = { userId, agentIds: [] };
            this.userAgentMappings.push(mapping);
          }

          if (!mapping.agentIds.includes(agent._id)) {
            mapping.agentIds.push(agent._id);
          }
        });
      }
    });
  }

  filterUsers(): void {
    const term = this.userSearchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredUsers = [...this.usersList];
    } else {
      this.filteredUsers = this.usersList.filter((user) => {
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        const email = user.email?.toLowerCase() || '';
        return fullName.includes(term) || email.includes(term);
      });
    }
    this.updateSelectAllUsersState();
  }

  filterAgents(): void {
    const term = this.agentSearchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredAgents = [...this.agentsList];
    } else {
      this.filteredAgents = this.agentsList.filter((agent) => {
        const agentName = (agent.agentName || agent.name || '').toLowerCase();
        const agentId = (agent.agentId || '').toLowerCase();
        return agentName.includes(term) || agentId.includes(term);
      });
    }
    this.updateSelectAllAgentsState();
  }

  // User selection methods
  toggleUserSelection(user: User): void {
    const index = this.selectedUsers.indexOf(user._id);
    if (index > -1) {
      // Deselecting user
      this.selectedUsers.splice(index, 1);
    } else {
      // Selecting user - load their existing agent mappings
      this.selectedUsers.push(user._id);
    }
    this.updateSelectAllUsersState();
    this.updateSelectAllAgentsState();
  }

  isUserSelected(userId: string): boolean {
    return this.selectedUsers.includes(userId);
  }

  toggleSelectAllUsers(): void {
    if (this.selectAllUsersChecked) {
      this.selectedUsers = this.filteredUsers.map((user) => user._id);
    } else {
      this.selectedUsers = [];
    }
    this.updateSelectAllAgentsState();
  }

  updateSelectAllUsersState(): void {
    this.selectAllUsersChecked =
      this.filteredUsers.length > 0 && this.selectedUsers.length === this.filteredUsers.length;
  }

  // Agent selection methods
  toggleAgentSelection(agent: Agent): void {
    if (this.selectedUsers.length === 0) return;

    const isCurrentlySelected = this.isAgentSelectedForSelectedUsers(agent._id);

    this.selectedUsers.forEach((userId) => {
      let mapping = this.userAgentMappings.find((m) => m.userId === userId);

      if (!mapping) {
        mapping = { userId, agentIds: [] };
        this.userAgentMappings.push(mapping);
      }

      const agentIndex = mapping.agentIds.indexOf(agent._id);

      if (isCurrentlySelected) {
        // Remove agent from user
        if (agentIndex > -1) {
          mapping.agentIds.splice(agentIndex, 1);
        }
      } else {
        // Add agent to user
        if (agentIndex === -1) {
          mapping.agentIds.push(agent._id);
        }
      }

      // Clean up empty mappings
      if (mapping.agentIds.length === 0) {
        const mappingIndex = this.userAgentMappings.indexOf(mapping);
        if (mappingIndex > -1) {
          this.userAgentMappings.splice(mappingIndex, 1);
        }
      }
    });

    this.updateSelectAllAgentsState();
  }

  isAgentSelectedForSelectedUsers(agentId: string): boolean {
    if (this.selectedUsers.length === 0) return false;

    return this.selectedUsers.every((userId) => {
      const mapping = this.userAgentMappings.find((m) => m.userId === userId);
      return mapping && mapping.agentIds.includes(agentId);
    });
  }

  isAgentSelectedForAnyUser(agentId: string): boolean {
    return this.userAgentMappings.some((mapping) => mapping.agentIds.includes(agentId));
  }

  toggleSelectAllAgents(): void {
    if (this.selectedUsers.length === 0) return;

    if (this.selectAllAgentsChecked) {
      this.selectedUsers.forEach((userId) => {
        let mapping = this.userAgentMappings.find((m) => m.userId === userId);
        if (!mapping) {
          mapping = { userId, agentIds: [] };
          this.userAgentMappings.push(mapping);
        }
        mapping.agentIds = [
          ...new Set([...mapping.agentIds, ...this.filteredAgents.map((a) => a._id)])
        ];
      });
    } else {
      this.selectedUsers.forEach((userId) => {
        const mapping = this.userAgentMappings.find((m) => m.userId === userId);
        if (mapping) {
          mapping.agentIds = mapping.agentIds.filter(
            (agentId) => !this.filteredAgents.find((a) => a._id === agentId)
          );

          if (mapping.agentIds.length === 0) {
            const index = this.userAgentMappings.indexOf(mapping);
            this.userAgentMappings.splice(index, 1);
          }
        }
      });
    }
  }

  updateSelectAllAgentsState(): void {
    if (this.selectedUsers.length === 0) {
      this.selectAllAgentsChecked = false;
      return;
    }

    this.selectAllAgentsChecked =
      this.filteredAgents.length > 0 &&
      this.filteredAgents.every((agent) => this.isAgentSelectedForSelectedUsers(agent._id));
  }

  // Count methods
  getUserMappedAgentsCount(userId: string): number {
    const mapping = this.userAgentMappings.find((m) => m.userId === userId);
    return mapping ? mapping.agentIds.length : 0;
  }

  getAgentMappedUsersCount(agentId: string): number {
    return this.userAgentMappings.filter((mapping) => mapping.agentIds.includes(agentId)).length;
  }

  getTotalMappingsCount(): number {
    return this.userAgentMappings.reduce((total, mapping) => total + mapping.agentIds.length, 0);
  }

  // Summary methods
  getMappingsSummary(): any[] {
    return this.userAgentMappings
      .filter((mapping) => mapping.agentIds.length > 0)
      .map((mapping) => {
        const user = this.usersList.find((u) => u._id === mapping.userId);
        const agents = mapping.agentIds
          .map((agentId) => this.agentsList.find((a) => a._id === agentId))
          .filter((agent) => agent !== undefined);

        return {
          userId: mapping.userId,
          userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown User',
          userEmail: user?.email || 'N/A',
          agents: agents
        };
      });
  }

  removeUserMapping(userId: string): void {
    const index = this.userAgentMappings.findIndex((m) => m.userId === userId);
    if (index > -1) {
      this.userAgentMappings.splice(index, 1);
    }
    // If this user is currently selected, deselect them
    const userIndex = this.selectedUsers.indexOf(userId);
    if (userIndex > -1) {
      this.selectedUsers.splice(userIndex, 1);
    }
    this.updateSelectAllUsersState();
    this.updateSelectAllAgentsState();
  }

  clearAllMappings(): void {
    this.userAgentMappings = [];
    this.selectedUsers = [];
    this.selectAllUsersChecked = false;
    this.selectAllAgentsChecked = false;
  }


  // Save and close methods
  saveMappings(): void {
    if (this.getTotalMappingsCount() === 0) {
      this.showErrorToast('No mappings to save');
      return;
    }

    this.showLoader();

    const payload = {
      companyId: this.selectedCompanyData._id,
      mappings: this.userAgentMappings
    };

    this._agentService
      .saveMappings(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.hideLoader();
          this.showSuccessToast('Mappings saved successfully!');
          this.mappingComplete.emit();
        },
        error: (error) => {
          this.hideLoader();
          this.showErrorToast(
            `Failed to save mappings: ${error?.error?.message || 'Unknown error'}`
          );
        }
      });
  }

  copyAgentId(agentId: string, index: string) {
    if (!agentId) return;

    navigator.clipboard.writeText(agentId).then(
      () => {
        this.showSuccessToast('agentId copied to clipboard!');
        this.copiedIndex = index;
        setTimeout(() => {
          this.copiedIndex = null;
        }, 2000);
      },
      (err) => {
        this.showErrorToast('Failed to copy agentId!');
      }
    );
  }


  getSuggestedWebhookUrl(agent: Agent): string {
    if (agent.voiceProvider === 'vapi') {
      return `${environment.apiUrl}/analytics/vapi-webhook/create?signature={CompanyWebhookToken}`;
    } else if (agent.voiceProvider === 'retell') {
      return `${environment.apiUrl}/analytics/webhook/create?signature={companyWebhookToken}`;
    }

    return '';
  }

  closeModal(): void {
    this.mappingComplete.emit();
  }
}
