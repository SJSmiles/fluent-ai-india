import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  QueryList,
  TemplateRef,
  ViewChild,
  ViewChildren
} from '@angular/core';
import { AppComponent } from 'app/app.component';
import { RecordsListComponent } from 'app/src/core/shared-component';
import { CallService, UserService } from 'app/src/shared/services';
import { Subject, takeUntil } from 'rxjs';
import {
  Lead_Status,
  Lead_Status_Filter,
  CALL_STATUS,
  DATE_RANGE_OPTIONS
} from 'app/src/config/constants/constants';
import { TimeFormatService } from 'app/src/shared/services/time-format.service';
import { CallStatusService } from 'app/src/shared/services/call-status.service';
import { NgbDropdown, NgbModal, NgbModalRef, NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from 'app/src/shared/services/auth/auth-service';
import { CompanyService } from 'app/src/shared/services/api/company.service';
import { AgentService } from 'app/src/shared/services/api/agent.services';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent extends RecordsListComponent<any> implements OnDestroy, OnInit {
  @ViewChild('callDetailsCanvas') callDetailsCanvas!: TemplateRef<any>;
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  @ViewChild('leadStatusDropdown') dropdown?: NgbDropdown;
  @ViewChild('createBatchFromCallsModal') createBatchFromCallsModal!: TemplateRef<any>;
  batchCallModalRef: NgbModalRef | null = null;
  AnalyticsStartDate: any;
  leadDistributionChanged: any;

  getMappedLeadStatus(status: string): string {
    if (!status) return 'Pending';
    if (!this.bmbyEnabled && (status.toLowerCase() === 'already bought' || status === 'Already Bought')) {
      return 'Already Successful / No Coaching Needed';
    }
    return status;
  }
  AnalyticsEndDate: any;
  private destroy$ = new Subject<void>();
  selectedCallType: any;
  statusCounts: any;
  callStatus = CALL_STATUS;
  currentSort: any;
  currentCallDetails: any;
  selectedText: string = '';
  clearFilter: boolean = false;
  leadStatusList: string[] = Lead_Status;
  leadStatusFilterList: string[] = Lead_Status_Filter;

  get bmbyEnabled(): boolean {
    if (this.currentUser?.user?.isSuperAdmin) {
      const selected = this.companyListing?.find((c: any) => c._id === this.companyId);
      return selected?.bmbyConfig || false;
    }
    return this.currentUser?.user?.bmbyConfig || false;
  }

  updateLeadStatusLists(): void {
    const isBmby = this.bmbyEnabled;
    this.leadStatusList = Lead_Status.map((status) =>
      !isBmby && status === 'Already Bought' ? 'Already Successful / No Coaching Needed' : status
    );
    this.leadStatusFilterList = Lead_Status_Filter.map((status) =>
      !isBmby && status === 'Already Bought' ? 'Already Successful / No Coaching Needed' : status
    );

    if (!isBmby) {
      if (!this.leadStatusFilterList.includes('Changed Interest')) {
        this.leadStatusFilterList.push('Changed Interest');
      }
      if (!this.leadStatusFilterList.includes('Not Interested - For Now')) {
        this.leadStatusFilterList.push('Not Interested - For Now');
      }
    }
  }
  isLeadStatusDropdownOpen: number | null = null; // Store the index of opened dropdown
  currentSelectedRecord: any;
  currentLeadStatus: any;
  selectedCallIds: string[] = [];
  selectedCallsData: any[] = [];
  agentList: any;
  selectedAgent: any;
  isCustomDate = false;

  startDate: Date | null = null;
  endDate: Date | null = null;
  maxStartDate: Date | null = null;
  minEndDate: Date | null = null;

  selectedDate = new Date();
  dateRange!: { startDate: Date; endDate: Date };
  selectedRange = 'last7Days';

  private readonly dateRangeList = this.initializeDateRangeList();
  private readonly displayOptions = DATE_RANGE_OPTIONS.map((option) => ({
    key: option.key,
    display: option.display
  }));
  userListing: any;
  userId: string | null = null;
  currentUser: any;
  userListLoaded: boolean = false;
  companyListing: any;
  companyId: string | null = null;
  companyListLoaded: boolean = false;
  private userInitialized = false;

  constructor(
    private appComponent: AppComponent,
    private _callService: CallService,
    private _companyService: CompanyService,
    private _timeFormatService: TimeFormatService,
    private _callStatusService: CallStatusService,
    private _offcanvasService: NgbOffcanvas,
    private _userService: UserService,
    private authService: AuthService,
    private _modalService: NgbModal,
    private _agentService: AgentService
  ) {
    super(appComponent);
    this.recordsFilter.sortBy = 'createdAt desc';
    let currentDate = new Date();
    let startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - 6);
    this.recordsFilter.startDate = this._timeFormatService.setDate(startDate, 'startDate');
    this.recordsFilter.endDate = this._timeFormatService.setDate(currentDate, 'endDate');
    this.initializeDateRange();
    this.currentSort = 'createdAt';
  }

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user: any) => {
      if (!user) return; // Wait until user is available

      this.currentUser = user;
      this.updateLeadStatusLists();

      // Set companyId from current user
      this.companyId = this.currentUser?.user?.companyId || null;
      if (this.companyId) {
        this.recordsFilter.companyId = this.companyId;
      }

      // Only call company listing if BOTH isSuperAdmin=true AND isAdmin=true
      if (
        this.currentUser?.user?.isSuperAdmin &&
        this.currentUser?.user?.isAdmin &&
        !this.companyListLoaded
      ) {
        this.companyListLoaded = true;
        this.getCompanyListing();
      }

      // Set userId from current user
      this.userId = this.currentUser?.user?._id || null;
      if (this.userId) {
        this.recordsFilter.userId = this.userId;
      }

      // Only call user listing if isAdmin=true (regardless of isSuperAdmin)
      if (this.currentUser?.user?.isAdmin && !this.userListLoaded) {
        this.userListLoaded = true;
        this.getUserListing();
      }

      // Initialize and call selectCallType only once
      if (!this.userInitialized) {
        this.userInitialized = true;
        this.selectCallType(0);
      }
    });
  }

  override sortStates: any = {
    createdAt: 'desc',
    duration: 'asc',
    status: 'asc',
    leadStatus: 'asc',
    bmbyId: 'asc'
  };

  getRecordsList(): void {
    this.getGroupRecordsList();
    this.cancelLeadStatusChange();
    this.showLoader();
    this._callService
      .listing(this.recordsFilter)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          this.recordsList = response?.data;
          this.statusCounts = response?.statusCounts;
          this.totalCount = response?.totalCount;
          this.clearSelection();
          this.hideLoader();
        },
        (err) => {
          this.showErrorToast(`Error in record fetching ${err?.error?.message}`);
          this.hideLoader();
        }
      );
  }

  getGroupRecordsList(): void {
    this.cancelLeadStatusChange();
    this.showLoader();
    this._callService
      .groupListing(this.recordsFilter)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          console.log('grouped response', response);
          this.hideLoader();
        },
        (err) => {
          this.showErrorToast(`Error in record fetching ${err?.error?.message}`);
          this.hideLoader();
        }
      );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  //about showing analytics
  showAnalytics: boolean = false;
  toggleAnalytics(): void {
    this.showAnalytics = !this.showAnalytics;
  }
  dateRangeChanged(event: any) {
    this.recordsFilter.startDate = this._timeFormatService.setDate(event?.startDate, 'startDate');
    this.recordsFilter.endDate = this._timeFormatService.setDate(event?.endDate, 'endDate');
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPage = 1;
    this.getRecordsList();
  }

  private initializeDateRangeList() {
    return DATE_RANGE_OPTIONS.map((option) => ({
      ...option,
      dateRange: this.createDateRange(this.getDaysAgo(option.key))
    }));
  }

  private findDateRangeOption(key: string) {
    return this.dateRangeList.find((option) => option.key === key);
  }

  selectDateRange(key: string): void {
    this.selectedRange = key;
    if (key !== 'custom') {
      const selectedOption = this.findDateRangeOption(key);
      if (!selectedOption) return;
      this.dateRange = { ...selectedOption.dateRange };
    }
    if (key === 'custom') {
      // this.handleCustomRange();
      this.minEndDate = this.dateRange?.startDate;
      this.maxStartDate = this.dateRange?.endDate;
      this.startDate = this.dateRange?.startDate;
      this.endDate = this.dateRange?.endDate;

      this.isCustomDate = true;
      return;
    }
    this.isCustomDate = false;
    this.dateRangeChanged(this.dateRange);
  }

  private getDaysAgo(key: string): number {
    const daysMap: Record<string, number> = {
      today: 0,
      last7Days: 6,
      last30Days: 29,
      custom: 0
    };
    return daysMap[key] || 0;
  }

  private createDateRange(daysAgoStart: number, daysAgoEnd = 0) {
    const today = new Date();
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const startDate = new Date(base);
    startDate.setDate(base.getDate() - daysAgoStart);

    const endDate = new Date(base);
    endDate.setDate(base.getDate() - daysAgoEnd);

    return { startDate, endDate };
  }

  private initializeDateRange(): void {
    const defaultOption = this.findDateRangeOption(this.selectedRange);
    if (defaultOption) {
      this.dateRange = defaultOption.dateRange;
    }
  }

  onDateRangeSelected(event: any, type: 'startDate' | 'endDate'): void {
    let selectedDate: Date | null = null;

    if (Array.isArray(event)) {
      selectedDate = event[0] ? new Date(event[0]) : null;
    } else if (event) {
      selectedDate = new Date(event);
    }

    if (!selectedDate) {
      return;
    }

    if (type === 'startDate') {
      this.startDate = selectedDate;
      this.minEndDate = selectedDate;
      this.dateRange.startDate = this.startDate;

      if (this.endDate && this.endDate < selectedDate) {
        this.endDate = null;
      }

      if (this.startDate && this.endDate) {
        this.selectedDateRange();
      }
    } else if (type === 'endDate') {
      this.endDate = selectedDate;
      this.maxStartDate = selectedDate;
      this.dateRange.endDate = this.endDate;
      if (this.startDate && this.startDate > selectedDate) {
        this.startDate = null;
      }
      if (this.startDate && this.endDate) {
        this.selectedDateRange();
      }
    }
  }

  selectedDateRange(): void {
    this.dateRange = {
      startDate: this.startDate!,
      endDate: this.endDate!
    };
    this.dateRangeChanged(this.dateRange);
  }

  getDisplayOptions(): { key: string; display: string }[] {
    return this.displayOptions;
  }

  selectCallType(key: any): void {
    this.selectedCallType = key;
    if (this.selectedCallType === 0) {
      delete this.recordsFilter.status;
    } else {
      this.recordsFilter.status = key;
    }
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPage = 1;

    // Always call getAgentList in every case
    this.getAgentList();
  }

  getStatusConfig(status: number) {
    return this._callStatusService.getCallStatus(status, this.callStatus);
  }

  formatDuration(record: any) {
    return this._timeFormatService.setTime(record);
  }

  sortActive(field: any) {
    const currentDirection = this.sortStates[field] || '';
    const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
    // Object.keys(this.sortStates).forEach((k) => (this.sortStates[k] = ''));
    this.sortStates[field] = newDirection;
    this.currentSort = field;
    this.recordsFilter.sortBy = `${field} ${newDirection}`;
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPage = 1;
    this.getRecordsList();
  }

  openCallDetails(record: any) {
    this.showLoader();
    this._callService.details(record?._id).subscribe(
      (response: any) => {
        this.currentCallDetails = response?.data;
        this.hideLoader();
        this.detailsModalOpen();
      },
      (err) => {
        this.showErrorToast(`${err?.error?.message}`);
        this.hideLoader();
      }
    );
  }

  detailsModalOpen() {
    this._offcanvasService.open(this.callDetailsCanvas, {
      position: 'end',
      panelClass: 'custom-offcanvas' // Add this line
    });
  }

  backToDashboard() {
    this._offcanvasService.dismiss();
  }

  customSearch(event: any) {
    if (event) {
      this.recordsFilter.search = event;
    } else {
      delete this.recordsFilter.search;
    }
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPage = 1;
    this.getRecordsList();
  }

  exportCallList(): void {
    delete this.recordsFilter.skip;
    delete this.recordsFilter.limit;
    this.showLoader();
    this.recordsFilter.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    this._callService.exportCall(this.recordsFilter).subscribe(
      (res: any) => {
        try {
          const blob = new Blob([res], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `call-list-${new Date().toISOString().slice(0, 10)}.xlsx`;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }, 100);

          this.hideLoader();
        } catch (error) {
          this.showErrorToast('Download failed. Please try again.');
          this.hideLoader();
        }
      },
      (error) => {
        this.showErrorToast(error.message);
        this.hideLoader();
      }
    );
  }

  selectLeadStatus(event: any) {
    if (event) {
      this.recordsFilter.leadStatus = event;
    } else {
      delete this.recordsFilter.leadStatus;
    }
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPage = 1;
    this.getRecordsList();
  }

  selectAgent(event: any) {
    if (event) {
      this.recordsFilter.agentId = event?.agentId;
    } else {
      delete this.recordsFilter.agentId;
    }
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPage = 1;
    this.getRecordsList();
  }

  selectUser(event: any) {
    this.selectedAgent = null;
    delete this.recordsFilter.agentId;

    if (event) {
      this.recordsFilter.userId = event;
      this.userId = event;
    } else {
      delete this.recordsFilter.userId;
      this.userId = null;
    }
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPage = 1;

    // Always call getAgentList
    this.getAgentList();
  }

  toggleLeadStatusDropdown(event: Event, index: number, record: any) {
    event.stopPropagation();
    event.preventDefault();
    this.isLeadStatusDropdownOpen = index;
    this.currentSelectedRecord = record;
    this.currentLeadStatus = record?.leadStatus;
  }

  saveLeadStatusChange() {
    const payload = {
      callId: this.currentSelectedRecord?.callId,
      leadStatus: this.currentLeadStatus
    };
    this.showLoader();
    this._callService.statusUpdate(payload).subscribe(
      (response: any) => {
        this.showSuccessToast('Lead Status Updated Sucessfully');
        this.isLeadStatusDropdownOpen = null;
        this.getRecordsList();
        this.hideLoader();
      },
      (err) => {
        this.showErrorToast(`${err?.error?.message}`);
        this.hideLoader();
      }
    );
  }

  cancelLeadStatusChange() {
    if (this.dropdown?.isOpen()) {
      this.dropdown.close();
    }
    this.isLeadStatusDropdownOpen = null;
  }

  changeLeadStatus(record: any) {
    this.currentLeadStatus = record;
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

        if (this.userListing && this.userListing.length > 0) {
          this.recordsFilter.userId = this.userListing[0]?._id;
          this.userId = this.userListing[0]?._id;
          this.selectedAgent = null;
          delete this.recordsFilter.agentId;

          // Call agent list after user is selected
          this.getAgentList();
        } else {
          this.hideLoader();
        }
      },
      (err) => {
        this.showErrorToast(`Error fetching users: ${err.error?.message || err.message}`);
        this.hideLoader();
      }
    );
  }

  toggleCallSelection(call: any, event: Event): void {
    event.stopPropagation(); // Prevent row click

    const callId = call._id;
    const index = this.selectedCallIds.indexOf(callId);

    if (index > -1) {
      // Remove from selection
      this.selectedCallIds.splice(index, 1);
      const dataIndex = this.selectedCallsData.findIndex((c) => c._id === callId);
      if (dataIndex > -1) {
        this.selectedCallsData.splice(dataIndex, 1);
      }
    } else {
      // Add to selection
      this.selectedCallIds.push(callId);
      this.selectedCallsData.push(call);
    }
  }

  // Check if a call is selected
  isCallSelected(callId: string): boolean {
    return this.selectedCallIds.includes(callId);
  }

  clearSelection(): void {
    this.selectedCallIds = [];
    this.selectedCallsData = [];
  }

  openCreateBatchFromCalls(): void {
    if (this.selectedCallIds.length === 0) {
      this.showErrorToast('Please select at least one call to create a batch');
      return;
    }

    this.batchCallModalRef = this._modalService.open(this.createBatchFromCallsModal, {
      size: 'xl',
      backdrop: 'static',
      keyboard: false,
      centered: true,
      windowClass: 'custom-lead-modal'
    });
  }

  batchCallCreateEvent(): void {
    this.clearSelection();
    this.getRecordsList();
    if (this.batchCallModalRef) {
      this.batchCallModalRef.close();
    }
  }

  // Get count of selected calls
  getSelectedCount(): number {
    return this.selectedCallIds.length;
  }

  selectCompany(event: any) {
    if (event) {
      this.recordsFilter.companyId = event;
      this.companyId = event;
    } else {
      delete this.recordsFilter.companyId;
      this.companyId = null;
    }

    // Reset user and agent selections
    this.userId = null;
    delete this.recordsFilter.userId;
    this.selectedAgent = null;
    delete this.recordsFilter.agentId;

    this.recordsFilter.skip = 0;
    this.updateLeadStatusLists();
    this.pageIndex = 0;
    this.currentPage = 1;

    // Always call getUserListing when company changes (for both superAdmin and admin)
    if (this.currentUser?.user?.isAdmin || this.currentUser?.user?.isSuperAdmin) {
      this.getUserListing();
    } else {
      // If not admin/superAdmin, set userId from currentUser and call agent list
      this.userId = this.currentUser?.user?._id || null;
      if (this.userId) {
        this.recordsFilter.userId = this.userId;
      }
      this.getAgentList();
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

  customSizeChanged(size: any): void {
    this.currentPageSize = parseInt(size, 10);
    this.recordsFilter.limit = this.currentPageSize;
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPage = 1;
    this.getRecordsList();
  }

  getAgentList(): void {
    const payload = {
      limit: 500,
      skip: 0,
      sortBy: 'agentName',
      sortOrder: 'asc',
      companyId: this.recordsFilter.companyId,
      userId: this.recordsFilter.userId
    };

    console.log('userid', payload.userId, 'companyId', payload.companyId);

    // Check if both userId and companyId are present
    if (!payload.userId || !payload.companyId) {
      console.warn('Missing userId or companyId for agent list');
      this.hideLoader();
      return;
    }

    this.showLoader();
    this._agentService.listing(payload).subscribe({
      next: (response: any) => {
        this.agentList = response?.data || [];
        // Always call getRecordsList after getting agent list
        this.getRecordsList();
      },
      error: (err: any) => {
        this.showErrorToast(`${err?.error?.message}`);
        this.hideLoader();
        // Still call getRecordsList even if agent list fails
        this.getRecordsList();
      }
    });
  }
}
