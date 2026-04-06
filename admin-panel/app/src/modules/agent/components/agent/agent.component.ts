import { Component, Inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NgbDropdown, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AppComponent } from 'app/app.component';
import { RecordsListComponent } from 'app/src/core/shared-component';
import { UserService } from 'app/src/shared/services';
import { AgentService } from 'app/src/shared/services/api/agent.services';
import { CompanyService } from 'app/src/shared/services/api/company.service';
import { AuthService } from 'app/src/shared/services/auth/auth-service';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-agent',
  templateUrl: './agent.component.html',
  styleUrls: ['./agent.component.scss']
})
export class AgentComponent extends RecordsListComponent<any> {
  @ViewChild('createAgentModel') createAgentModel!: TemplateRef<any>;
  private destroy$ = new Subject<void>();
  currentSort: any;
  selectedText: string = '';
  clearFilter: boolean = false;
  selectedAgentData: any = null;
  selectedAgentPrompt: any = null;
  userListing: any[] = [];
  userId: string | null = null;
  currentUser: any;
  selectedUserId: string | null = null;
  modalMode: 'details' | 'update' = 'details';
  companyListing: any;
  companyId: string | null = null;
  companyListLoaded: boolean = false;

  override sortStates: any = {
    agentName: 'asc'
  };

  override recordsFilter: any = {
    skip: 0,
    limit: 10,
    sortBy: 'agentName',
    sortOrder: 'asc'
  };

  constructor(
    @Inject(AppComponent) private appComponent: AppComponent,
    @Inject(AgentService) private _agentService: AgentService,
    @Inject(NgbModal) private _modalService: NgbModal,
    private _userService: UserService,
    private authService: AuthService,
    private _companyService: CompanyService
  ) {
    super(appComponent);
    this.authService.currentUser$.subscribe((user: any) => {
      this.currentUser = user;
      this.companyId = this.currentUser?.user?.companyId || null;
      if (this.companyId) {
        this.recordsFilter.companyId = this.companyId;
      }
      if (this.currentUser?.user?.isAdmin && !this.currentUser?.user?.isSuperAdmin) {
        this.selectedUserId = this.currentUser?.user?._id;
        this.userId = this.selectedUserId;
        this.recordsFilter.userId = this.selectedUserId;
      }
      if (this.currentUser?.user?.isSuperAdmin && !this.companyListLoaded) {
        this.companyListLoaded = true;
        this.getCompanyListing();
      }
    });
    if (this.currentUser?.user?.isAdmin) {
      this.getUserListing();
    }
    this.recordsFilter.userId = this.currentUser?.user?._id;
    this.getRecordsList();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  override getRecordsList(): void {
    this.showLoader();
    this._agentService.listing(this.recordsFilter).subscribe({
      next: (response: any) => {
        this.recordsList = response?.data || [];
        this.totalCount = response?.totalCount;
        this.hideLoader();
      },
      error: (err: any) => {
        this.showErrorToast(`${err?.error?.message}`);
        this.hideLoader();
      }
    });
  }

  sortActive(field: any) {
    const currentDirection = this.sortStates[field] || '';
    const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
    Object.keys(this.sortStates).forEach((k) => (this.sortStates[k] = ''));
    this.sortStates[field] = newDirection;
    this.currentSort = field;
    this.recordsFilter.sortBy = field;
    this.recordsFilter.sortOrder = newDirection;
    this.goToPageOne();
    this.getRecordsList();
  }

  override search($event: any) {
    const value = $event;
    if (value !== undefined && value !== null && value !== '') {
      this.recordsFilter.limit = this.currentPageSize;
      this.recordsFilter.search = value;
    } else {
      delete this.recordsFilter.search;
    }
    delete this.recordsFilter.search;
    this.goToPageOne();
    this.getRecordsList();
  }

  customSearch(event: any) {
    if (event) {
      this.recordsFilter.search = event;
    } else {
      delete this.recordsFilter.search;
    }
    this.goToPageOne();
    this.getRecordsList();
  }

  goToPageOne() {
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 10;
    this.currentPage = 1;
  }

  agentDetails(record: any): void {
    this.selectedAgentData = record;
    this.modalMode = 'details';
    this._modalService.open(this.createAgentModel, {
      centered: true,
      size: 'xl',
      backdrop: 'static'
    });
  }

  getUserListing() {
    this.showLoader();

    const params: any = {};
    if (this.currentUser?.user?.isSuperAdmin && this.companyId) {
      params.companyId = this.companyId;
    }

    this._userService.filterListing(params).subscribe(
      (response: any) => {
        this.userListing = response?.data?.map((user: any) => {
          const name = `${user.firstName} ${user.lastName || ''}`.trim();
          const truncatedName = name.length > 15 ? name.slice(0, 15) + '…' : name;
          return { ...user, fullName: truncatedName };
        });

        // ✅ Auto-select first user after getting new user list
        if (
          this.userListing &&
          this.userListing.length > 0 &&
          this.currentUser?.user?.isSuperAdmin
        ) {
          this.userId = this.userListing[0]._id;
          this.recordsFilter.userId = this.userId;
          this.getRecordsList(); // ✅ Fetch records with the new user selected
        }

        this.hideLoader();
      },
      (err) => {
        this.showErrorToast(`Error fetching users: ${err.error?.message || err.message}`);
        this.hideLoader();
      }
    );
  }

  selectUser(event: any) {
    this.selectedUserId = event || this.currentUser?.user?._id || this.currentUser?.user?.id;
    this.userId = this.selectedUserId;

    if (this.selectedUserId) {
      this.recordsFilter.userId = this.selectedUserId;
    } else {
      delete this.recordsFilter.userId;
    }

    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 10;
    this.currentPage = 1;
    this.getRecordsList();
  }

  updateAgent(record: any): void {
    this.selectedAgentData = record;
    this.modalMode = 'update';
    this._modalService.open(this.createAgentModel, {
      centered: true,
      size: 'xl',
      backdrop: 'static'
    });
  }

  handleUpdateAgent(event: { id: string; payload: any }) {
    this.showLoader();
    this._agentService.updatePrompt(event.id, event.payload).subscribe({
      next: (res: any) => {
        this.showSuccessToast('Agent updated successfully');
        this.getRecordsList(); // refresh list
        this._modalService.dismissAll();
      },
      error: (err: any) => {
        this.showErrorToast(err?.error?.message || 'Update failed');
        this.hideLoader();
      }
    });
  }

  selectCompany(event: any) {
    if (event) {
      this.recordsFilter.companyId = event;
      this.companyId = event;
    } else {
      delete this.recordsFilter.companyId;
      this.companyId = null;
    }

    this.userId = null;
    delete this.recordsFilter.userId;

    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 10;
    this.currentPage = 1;

    if (this.currentUser?.user?.isSuperAdmin) {
      this.getUserListing();
    }
  }

  getCompanyListing() {
    this.showLoader();
    this._companyService.getCompanyFilterList().subscribe(
      (response: any) => {
        this.companyListing = response?.data?.companies?.map((company: any) => {
          const name = `${company.name || ''}`.trim();
          const truncatedName = name.length > 15 ? name.slice(0, 15) + '…' : name;
          return {
            ...company,
            fullName: truncatedName
          };
        });
      },
      (err) => {
        this.showErrorToast(`Error in record fetching: ${err.error?.message || err.message}`);
        this.hideLoader();
      }
    );
  }

  handlePrimaryToggle(event: Event, modal: any, record: any) {
    event.preventDefault(); // Prevent toggle from changing immediately
    event.stopPropagation(); // Stop row click

    if (record.isPrimary) {
      return; // Should be disabled anyway, but safety check
    }

    this.selectedAgentData = record;
    this._modalService.open(modal, { centered: true }).result.then(
      (result) => {
        if (result === 'save') {
          this.setPrimaryAgent(record);
        }
        // If cancelled, do nothing (toggle remains in previous state because of preventDefault)
      },
      (reason) => {
        // Dismissed - do nothing
      }
    );
  }

  setPrimaryAgent(record: any) {
    // Get userId: priority 1: filter userId, priority 2: current user id
    const userId = this.recordsFilter.userId || this.currentUser?.user?._id;

    if (!userId) {
      this.showErrorToast('User ID is required to set primary agent');
      return;
    }

    const payload = {
      userId: userId,
      agentId: record._id
    };

    this.showLoader();
    this._agentService.setPrimaryAgent(payload).subscribe({
      next: (res: any) => {
        this.showSuccessToast('Primary agent set successfully');
        this.getRecordsList(); // Refresh list to show updated status
      },
      error: (err: any) => {
        this.showErrorToast(err?.error?.message || 'Failed to set primary agent');
        this.hideLoader();
      }
    });
  }
}
