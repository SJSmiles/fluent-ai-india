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

export type SortColumn = 'date' | 'duration' | 'name' | null;
export type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-dashboard-new',
  templateUrl: './dashboard-new.component.html',
  styleUrls: ['./dashboard-new.component.scss']
})
export class DashboardNewComponent extends RecordsListComponent<any> implements OnDestroy, OnInit {
  @ViewChild('callDetailsCanvas') callDetailsCanvas!: TemplateRef<any>;
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;
  @ViewChild('leadStatusDropdown') dropdown?: NgbDropdown;
  @ViewChild('createBatchFromCallsModal') createBatchFromCallsModal!: TemplateRef<any>;
  @ViewChild('commentModal') commentModal!: TemplateRef<any>;
  @ViewChild('changeStatusModal') changeStatusModal!: TemplateRef<any>;
  @ViewChild('callDetailsModal') callDetailsModal!: TemplateRef<any>;

  callDetailsModalRef: NgbModalRef | null = null;
  changeStatusModalRef: NgbModalRef | null = null;
  commentModalRef: NgbModalRef | null = null;
  batchCallModalRef: NgbModalRef | null = null;

  selectedCallDetailsData: any = null;
  currentCallDetails: any;
  currentSelectedCall: any;

  currentLeadStatusForModal: string = '';
  newLeadStatus: string = '';
  currentRecordForStatusChange: any = null;
  latestCallId: string = '';

  sortColumn: SortColumn = null;
  sortDirection: SortDirection = 'asc';
  currentSort: any;
  selectedCallType: any;
  statusCounts: any;
  callStatus = CALL_STATUS;
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
  selectedLeadStatus: string[] | null = null;
  selectedAgent: string | null = null;
  selectedAttempts: string = '';
  searchText: string = '';

  isCustomDate = false;
  startDate: Date | null = null;
  endDate: Date | null = null;
  maxStartDate: Date | null = null;
  minEndDate: Date | null = null;
  selectedDate = new Date();
  dateRange!: { startDate: Date; endDate: Date };
  selectedRange = 'last7Days';

  userListing: any[] = [];
  userId: string | null = null;
  currentUser: any;
  companyListing: any[] = [];
  companyId: string | null = null;
  agentList: any[] = [];

  expandedRowIndex: number | null = null;
  selectedRecords: any;
  displayedMessages: number = 4;
  expandedRowCommentsList: any[] = [];
  expandedRowCommentsLoading: boolean = false;
  expandedRowCommentsTotalCount: number = 0;

  commentText: string = '';
  maxCommentLength: number = 500;
  commentsList: any[] = [];
  commentsLoading: boolean = false;
  currentPhoneForComments: string = '';
  currentCustomerName: string = '';
  commentsTotalCount: number = 0;

  activeTab: string = 'overview';
  showAnalytics: boolean = false;
  isLeadStatusDropdownOpen: number | null = null;
  currentSelectedRecord: any;
  currentLeadStatus: any;

  selectedCallIds: string[] = [];
  selectedCallsData: any[] = [];
  leadDistributionChanged: any;

  getMappedLeadStatus(status: string): string {
    if (!status) return 'Pending';
    if (!this.bmbyEnabled && (status.toLowerCase() === 'already bought' || status === 'Already Bought')) {
      return 'Already Successful / No Coaching Needed';
    }
    return status;
  }

  private destroy$ = new Subject<void>();
  private userInitialized = false;
  private isInitializing = false;
  private isClearingFilters = false;

  private readonly dateRangeList = this.initializeDateRangeList();
  private readonly displayOptions = DATE_RANGE_OPTIONS.map((option) => ({
    key: option.key,
    display: option.display
  }));

  override sortStates: any = {
    createdAt: 'desc',
    duration: 'asc',
    status: 'asc',
    leadStatus: 'asc',
    bmbyId: 'asc'
  };

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
    this.initializeFilters();
  }

  private initializeFilters(): void {
    this.recordsFilter.sortBy = 'createdAt desc';
    const currentDate = new Date();
    const startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - 6);
    this.recordsFilter.startDate = this._timeFormatService.setDate(startDate, 'startDate');
    this.recordsFilter.endDate = this._timeFormatService.setDate(currentDate, 'endDate');
    this.initializeDateRange();
    this.currentSort = 'createdAt';

    this.selectedLeadStatus = null;
    this.selectedAgent = null;
    this.searchText = '';
  }

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user: any) => {
      if (!user || this.userInitialized) return;

      this.currentUser = user;
      this.updateLeadStatusLists();
      this.initializeUserData();
    });
  }

  private initializeUserData(): void {
    if (this.isInitializing) return;
    this.isInitializing = true;

    this.companyId = this.currentUser?.user?.companyId || null;
    if (this.companyId) {
      this.recordsFilter.companyId = this.companyId;
    }

    this.userId = this.currentUser?.user?._id || null;
    if (this.userId) {
      this.recordsFilter.userId = this.userId;
    }

    if (this.currentUser?.user?.isSuperAdmin && this.currentUser?.user?.isAdmin) {
      this.getCompanyListing();
    }

    if (this.currentUser?.user?.isAdmin) {
      this.getUserListing();
    } else {
      this.userInitialized = true;
      this.loadAgentsAndRecords();
    }
  }

  private loadAgentsAndRecords(): void {
    if (!this.recordsFilter.userId || !this.recordsFilter.companyId) {
      this.isInitializing = false;
      return;
    }

    this.selectedCallType = 0;
    this.getAgentList();
  }

  getUserListing(): void {
    this.showLoader();

    const params: any = {};
    if (this.currentUser?.user?.isSuperAdmin && this.companyId) {
      params.companyId = this.companyId;
    }

    this._userService
      .filterListing(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          this.userListing = response?.data?.map((user: any) => {
            const name = `${user.firstName} ${user.lastName || ''}`.trim();
            const truncatedName = name.length > 15 ? name.slice(0, 15) + '…' : name;
            return { ...user, fullName: truncatedName };
          });

          if (this.userListing?.length > 0) {
            if (this.companyId === this.currentUser?.user?.companyId) {
              this.recordsFilter.userId = this.currentUser?.user?._id || null;
              this.userId = this.currentUser?.user?._id || null;
            } else {
              this.recordsFilter.userId = this.userListing[0]._id;
              this.userId = this.userListing[0]._id;
            }
            this.selectedAgent = null;
            delete this.recordsFilter.agentId;

            this.userInitialized = true;
            this.loadAgentsAndRecords();
          } else {
            this.hideLoader();
            this.isInitializing = false;
          }
        },
        (err) => {
          this.showErrorToast(`Error fetching users: ${err.error?.message || err.message}`);
          this.hideLoader();
          this.isInitializing = false;
        }
      );
  }

  getCompanyListing(): void {
    this._companyService
      .getCompanyFilterList()
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          this.companyListing = response?.data?.companies?.map((company: any) => {
            const name = `${company.name || ''}`.trim();
            const truncatedName = name.length > 15 ? name.slice(0, 15) + '…' : name;
            return { ...company, fullName: truncatedName };
          });
        },
        (err) => {
          this.showErrorToast(`Error fetching companies: ${err.error?.message || err.message}`);
        }
      );
  }

  getAgentList(): void {
    if (!this.recordsFilter.userId || !this.recordsFilter.companyId) {
      if (this.expandedRowIndex !== null) {
        this.collapseRow();
      }
      this.getRecordsList();
      return;
    }

    const payload = {
      limit: 500,
      skip: 0,
      sortBy: 'agentName',
      sortOrder: 'asc',
      companyId: this.recordsFilter.companyId,
      userId: this.recordsFilter.userId
    };

    this.showLoader();

    this._agentService
      .listing(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.agentList = response?.data || [];
          if (this.expandedRowIndex !== null) {
            this.collapseRow();
          }
          this.getRecordsList();
        },
        error: (err: any) => {
          if (this.expandedRowIndex !== null) {
            this.collapseRow();
          }
          this.getRecordsList();
        }
      });
  }

  getRecordsList(): void {
    this.cancelLeadStatusChange();
    this.showLoader();

    this._callService
      .groupListing(this.recordsFilter)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          this.recordsList = response?.data || [];
          this.statusCounts = response?.statusCounts;
          this.totalCount = response?.totalCount || 0;
          this.clearSelection();
          this.hideLoader();
          this.isInitializing = false;
        },
        (err) => {
          this.showErrorToast(`Error fetching records: ${err?.error?.message || err.message}`);
          this.hideLoader();
          this.isInitializing = false;
        }
      );
  }

  selectCallType(key: any): void {
    this.selectedCallType = key;
    if (key === 0) {
      delete this.recordsFilter.status;
    } else {
      this.recordsFilter.status = key;
    }
    this.resetPagination();
    if (this.expandedRowIndex !== null) {
      this.collapseRow();
    }
    this.getRecordsList();
  }

  selectAgent(event: any): void {
    if (event === null || event === undefined) {
      this.selectedAgent = null;
      delete this.recordsFilter.agentId;
    } else {
      const agentId = typeof event === 'string' ? event : event?.agentId;
      this.selectedAgent = agentId;
      this.recordsFilter.agentId = agentId;
    }

    this.resetPagination();

    if (!this.isClearingFilters) {
      if (this.expandedRowIndex !== null) {
        this.collapseRow();
      }
      this.getRecordsList();
    }
  }

  selectUser(event: any): void {
    this.selectedAgent = null;
    delete this.recordsFilter.agentId;

    if (event) {
      this.recordsFilter.userId = event;
      this.userId = event;
    } else {
      delete this.recordsFilter.userId;
      this.userId = null;
    }

    this.resetPagination();

    if (!this.isClearingFilters) {
      this.getAgentList();
    }
  }

  selectCompany(event: any): void {
    if (event) {
      this.recordsFilter.companyId = event;
      this.companyId = event;
    } else {
      delete this.recordsFilter.companyId;
      this.companyId = null;
    }

    this.userId = null;
    delete this.recordsFilter.userId;
    this.selectedAgent = null;
    delete this.recordsFilter.agentId;

    this.resetPagination();
    this.updateLeadStatusLists();

    if (!this.isClearingFilters) {
      if (this.currentUser?.user?.isAdmin) {
        this.getUserListing();
      } else {
        this.userId = this.currentUser?.user?._id || null;
        if (this.userId) {
          this.recordsFilter.userId = this.userId;
        }
        this.getAgentList();
      }
    }
  }

  selectLeadStatus(event: any): void {
    this.selectedLeadStatus = event && event.length > 0 ? event : null;

    if (this.selectedLeadStatus) {
      this.recordsFilter.leadStatus = this.selectedLeadStatus;
    } else {
      delete this.recordsFilter.leadStatus;
    }

    this.resetPagination();

    if (!this.isClearingFilters) {
      if (this.expandedRowIndex !== null) {
        this.collapseRow();
      }
      this.getRecordsList();
    }
  }

  customSearch(event: any): void {
    this.searchText = event || '';

    if (event) {
      this.recordsFilter.search = event;
    } else {
      delete this.recordsFilter.search;
    }

    this.resetPagination();

    if (!this.isClearingFilters) {
      if (this.expandedRowIndex !== null) {
        this.collapseRow();
      }
      this.getRecordsList();
    }
  }

  customSizeChanged(size: any): void {
    if (this.expandedRowIndex !== null) {
      this.collapseRow();
    }
    this.currentPageSize = parseInt(size, 10);
    this.recordsFilter.limit = this.currentPageSize;
    this.resetPagination();
    if (this.expandedRowIndex !== null) {
      this.collapseRow();
    }
    this.getRecordsList();
  }

  private resetPagination(): void {
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPage = 1;
  }

  toggleAnalytics(): void {
    this.showAnalytics = !this.showAnalytics;
  }

  dateRangeChanged(event: any): void {
    if (this.expandedRowIndex !== null) {
      this.collapseRow();
    }
    this.recordsFilter.startDate = this._timeFormatService.setDate(event?.startDate, 'startDate');
    this.recordsFilter.endDate = this._timeFormatService.setDate(event?.endDate, 'endDate');
    this.resetPagination();
    if (this.expandedRowIndex !== null) {
      this.collapseRow();
    }
    this.getRecordsList();
  }

  selectDateRange(key: string): void {
    this.selectedRange = key;

    if (key === 'custom') {
      this.minEndDate = this.dateRange?.startDate;
      this.maxStartDate = this.dateRange?.endDate;
      this.startDate = this.dateRange?.startDate;
      this.endDate = this.dateRange?.endDate;
      this.isCustomDate = true;
      return;
    }

    const selectedOption = this.findDateRangeOption(key);
    if (selectedOption) {
      this.dateRange = { ...selectedOption.dateRange };
      this.isCustomDate = false;
      this.dateRangeChanged(this.dateRange);
    }
  }

  onDateRangeSelected(event: any, type: 'startDate' | 'endDate'): void {
    let selectedDate: Date | null = null;

    if (Array.isArray(event)) {
      selectedDate = event[0] ? new Date(event[0]) : null;
    } else if (event) {
      selectedDate = new Date(event);
    }

    if (!selectedDate) return;

    if (type === 'startDate') {
      this.startDate = selectedDate;
      this.minEndDate = selectedDate;
      this.dateRange.startDate = this.startDate;

      if (this.endDate && this.endDate < selectedDate) {
        this.endDate = null;
      }
    } else {
      this.endDate = selectedDate;
      this.maxStartDate = selectedDate;
      this.dateRange.endDate = this.endDate;

      if (this.startDate && this.startDate > selectedDate) {
        this.startDate = null;
      }
    }

    if (this.startDate && this.endDate) {
      this.selectedDateRange();
    }
  }

  selectedDateRange(): void {
    if (!this.startDate || !this.endDate) return;

    this.dateRange = {
      startDate: this.startDate,
      endDate: this.endDate
    };
    this.dateRangeChanged(this.dateRange);
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

  getDisplayOptions(): { key: string; display: string }[] {
    return this.displayOptions;
  }

  sortActive(field: any): void {
    const currentDirection = this.sortStates[field] || '';
    const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
    this.sortStates[field] = newDirection;
    this.currentSort = field;
    this.recordsFilter.sortBy = `${field} ${newDirection}`;
    this.resetPagination();
    if (this.expandedRowIndex !== null) {
      this.collapseRow();
    }
    this.getRecordsList();
  }

  openCallDetails(record: any): void {
    this.showLoader();
    this._callService
      .details(record?._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          this.currentCallDetails = response?.data;
          this.hideLoader();
          this.detailsModalOpen();
        },
        (err) => {
          this.showErrorToast(`${err?.error?.message || 'Error loading call details'}`);
          this.hideLoader();
        }
      );
  }

  detailsModalOpen(): void {
    this._offcanvasService.open(this.callDetailsCanvas, {
      position: 'end',
      panelClass: 'custom-offcanvas'
    });
  }

  openFullDetails(selectedRecords: any): void {
    if (!selectedRecords) {
      this.showErrorToast('No call details available');
      return;
    }

    this.selectedCallDetailsData = selectedRecords;

    this.callDetailsModalRef = this._modalService.open(this.callDetailsModal, {
      size: 'xl',
      backdrop: 'static',
      keyboard: false,
      centered: true,
      windowClass: 'call-details-modal'
    });
  }

  closeCallDetailsModal(): void {
    if (this.callDetailsModalRef) {
      this.callDetailsModalRef.close();
    }
    this.selectedCallDetailsData = null;
  }

  viewFullTranscript(): void {
    this.activeTab = 'transcript';
    this.openFullDetails(this.selectedRecords);
  }

  toggleExpand(record: any, index: number): void {
    if (this.expandedRowIndex === index) {
      this.collapseRow();
      return;
    }

    const payload = {
      phoneNumber: record.phoneNumber,
      companyId: this.recordsFilter.companyId,
      userId: this.recordsFilter.userId,
      startDate: this.recordsFilter.startDate,
      endDate: this.recordsFilter.endDate
    };

    this.showLoader();
    this._callService
      .phoneDetails(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          this.selectedRecords = response?.data;

          if (this.selectedRecords?.calls?.length > 0) {
            this.selectedRecords.calls = this.selectedRecords.calls.map(
              (call: any, idx: number) => ({
                ...call,
                isSelected: idx === 0
              })
            );
            this.currentSelectedCall = this.selectedRecords.calls[0];
          }

          this.loadCommentsForExpandedRow(record.phoneNumber);
          this.expandedRowIndex = index;
          this.hideLoader();
        },
        (err) => {
          this.showErrorToast(`Error loading call details: ${err?.error?.message || err.message}`);
          this.hideLoader();
        }
      );
  }

  private collapseRow(): void {
    this.expandedRowIndex = null;
    this.selectedRecords = null;
    this.currentSelectedCall = null;
    this.expandedRowCommentsList = [];
    this.expandedRowCommentsTotalCount = 0;
  }

  isRowExpanded(index: number): boolean {
    return this.expandedRowIndex === index;
  }

  selectCallAttempt(callIndex: number): void {
    if (!this.selectedRecords?.calls) return;

    this.selectedRecords.calls = this.selectedRecords.calls.map((call: any, idx: number) => ({
      ...call,
      isSelected: idx === callIndex
    }));

    this.currentSelectedCall = this.selectedRecords.calls[callIndex];
  }

  loadCommentsForExpandedRow(phoneNumber: string): void {
    if (!phoneNumber) return;

    this.expandedRowCommentsLoading = true;

    let cleanPhone = phoneNumber.trim();
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = '+' + cleanPhone;
    }

    const params = {
      phone: cleanPhone,
      skip: 0,
      limit: 3,
      sortBy: '-createdAt'
    };

    this._callService
      .getCommentList(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          if (response.success) {
            this.expandedRowCommentsList = response.data || [];
            this.expandedRowCommentsTotalCount = response.totalCount || 0;
          }
          this.expandedRowCommentsLoading = false;
        },
        (err) => {
          this.expandedRowCommentsLoading = false;
        }
      );
  }

  openCommentsModal(record: any): void {
    this.currentPhoneForComments = record.phoneNumber;
    this.currentCustomerName = record.customerName;
    this.commentText = '';

    this.commentModalRef = this._modalService.open(this.commentModal, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false,
      centered: true,
      windowClass: 'comment-modal'
    });

    this.loadCommentsAndMarkAsRead();
  }

  loadCommentsAndMarkAsRead(): void {
    if (!this.currentPhoneForComments) return;

    this.commentsLoading = true;

    let cleanPhone = this.currentPhoneForComments.trim();
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = '+' + cleanPhone;
    }

    const params = {
      phone: cleanPhone,
      skip: 0,
      limit: 100,
      sortBy: '-createdAt'
    };

    this._callService
      .getCommentList(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          if (response.success) {
            this.commentsList = response.data || [];
            this.commentsTotalCount = response.totalCount || 0;
            this.markAllCommentsAsRead(cleanPhone);
          }
          this.commentsLoading = false;
        },
        (err) => {
          this.showErrorToast(`Failed to load comments: ${err?.error?.message || err.message}`);
          this.commentsLoading = false;
        }
      );
  }

  markAllCommentsAsRead(phoneNumber: string): void {
    if (!phoneNumber) return;

    const currentUserId = this.currentUser?.user?._id;
    if (!currentUserId) return;

    const hasUnreadComments = this.commentsList.some((comment: any) => {
      if (!comment.readBy || !Array.isArray(comment.readBy)) {
        return true;
      }

      const isRead = comment.readBy.some((id: any) => {
        const readByUserId =
          typeof id === 'string' ? id : id._id ? id._id.toString() : id.toString();
        return readByUserId === currentUserId.toString();
      });

      return !isRead;
    });

    if (!hasUnreadComments) return;

    const payload = { phone: phoneNumber };

    this._callService
      .markAsRead(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          if (response.success) {
            this.commentsList.forEach((comment: any) => {
              if (!comment.readBy) {
                comment.readBy = [];
              }

              const alreadyRead = comment.readBy.some((id: any) => {
                const readByUserId =
                  typeof id === 'string' ? id : id._id ? id._id.toString() : id.toString();
                return readByUserId === currentUserId.toString();
              });

              if (!alreadyRead) {
                comment.readBy.push(currentUserId);
              }

              comment.isReadByCurrentUser = true;
            });

            this.refreshMainListAfterMarkingRead();
          }
        },
        (err) => {
          console.error('Error marking comments as read:', err);
        }
      );
  }

  refreshMainListAfterMarkingRead(): void {
    this._callService
      .groupListing(this.recordsFilter)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          this.recordsList = response?.data || [];

          if (
            this.selectedRecords &&
            this.selectedRecords.phoneNumber === this.currentPhoneForComments
          ) {
            this.loadCommentsForExpandedRow(this.currentPhoneForComments);
          }
        },
        (err) => {
          console.error('Failed to refresh main list:', err);
        }
      );
  }

  addNewComment(): void {
    if (!this.commentText || this.commentText.trim().length === 0) {
      this.showErrorToast('Please enter a comment');
      return;
    }

    if (this.commentText.length > this.maxCommentLength) {
      this.showErrorToast(`Comment cannot exceed ${this.maxCommentLength} characters`);
      return;
    }

    let cleanPhone = this.currentPhoneForComments.trim();
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = '+' + cleanPhone;
    }

    const payload = {
      phone: cleanPhone,
      comment: this.commentText.trim(),
      callId: this.currentSelectedCall?._id || undefined
    };

    this.showLoader();

    this._callService
      .createComment(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          if (response.success) {
            this.showSuccessToast('Comment added successfully');
            this.commentText = '';
            this.loadCommentsAndMarkAsRead();

            if (this.selectedRecords?.phoneNumber === cleanPhone) {
              this.loadCommentsForExpandedRow(cleanPhone);
            }
          } else {
            this.showErrorToast(response.message || 'Failed to add comment');
          }
          this.hideLoader();
        },
        (err) => {
          this.showErrorToast(`Error: ${err?.error?.message || err.message}`);
          this.hideLoader();
        }
      );
  }

  closeCommentsModal(): void {
    if (this.commentModalRef) {
      this.commentModalRef.close();
    }

    this.commentText = '';
    this.commentsList = [];
    this.commentsLoading = false;
    this.commentsTotalCount = 0;
    this.currentPhoneForComments = '';
    this.currentCustomerName = '';
  }

  getCharacterCount(): string {
    return `${this.commentText.length}/${this.maxCommentLength}`;
  }

  getCommentAuthorName(comment: any): string {
    if (!comment.createdBy) return 'Unknown';

    const firstName = comment.createdBy.firstName || '';
    const lastName = comment.createdBy.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();

    if (comment.createdBy._id === this.currentUser?.user?._id) {
      return 'You';
    }

    return fullName || comment.createdBy.email || 'Unknown';
  }

  formatCommentTimestamp(timestamp: string): string {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  toggleLeadStatusDropdown(event: Event, index: number, record: any): void {
    event.stopPropagation();
    event.preventDefault();
    this.isLeadStatusDropdownOpen = index;
    this.currentSelectedRecord = record;
    this.currentLeadStatus = record?.leadStatus;
  }

  cancelLeadStatusChange(): void {
    if (this.dropdown?.isOpen()) {
      this.dropdown.close();
    }
    this.isLeadStatusDropdownOpen = null;
  }

  changeLeadStatus(record: any): void {
    this.currentLeadStatus = record;
  }

  changeStatus(): void {
    if (!this.selectedRecords?.calls?.length) {
      this.showErrorToast('No call records available');
      return;
    }

    const latestCall = this.selectedRecords.calls[0];

    this.currentRecordForStatusChange = this.selectedRecords;
    this.latestCallId = latestCall.callId;
    this.currentLeadStatusForModal = latestCall.leadStatus || 'N/A';
    this.newLeadStatus = latestCall.leadStatus || '';

    this.changeStatusModalRef = this._modalService.open(this.changeStatusModal, {
      size: 'md',
      backdrop: 'static',
      keyboard: false,
      centered: true,
      windowClass: 'change-status-modal'
    });
  }

  saveLeadStatusChange(): void {
    if (!this.newLeadStatus || !this.latestCallId) {
      this.showErrorToast('Please select a status');
      return;
    }

    if (this.newLeadStatus === this.currentLeadStatusForModal) {
      this.showErrorToast('Please select a different status');
      return;
    }

    const phoneNumber = this.currentRecordForStatusChange?.phoneNumber;
    const companyId = this.recordsFilter.companyId;
    const userId = this.recordsFilter.userId;

    const payload = {
      callId: this.latestCallId,
      leadStatus: this.newLeadStatus
    };

    this.showLoader();

    this._callService
      .statusUpdate(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          this.showSuccessToast('Lead Status Updated Successfully');
          this.closeChangeStatusModal();
          if (response) {
            this.leadDistributionChanged = 'case13';
          }

          if (phoneNumber && companyId && userId) {
            this.refreshExpandedRowData(phoneNumber, companyId, userId);
            this.refreshMainList();
          } else {
            this.hideLoader();
          }
        },
        (err) => {
          this.showErrorToast(`${err?.error?.message || 'Failed to update status'}`);
          this.hideLoader();
        }
      );
  }

  refreshExpandedRowData(phoneNumber: string, companyId: string, userId: string): void {
    if (!phoneNumber || !companyId || !userId) {
      return;
    }

    const phoneDetailsPayload = {
      phoneNumber: phoneNumber,
      companyId: companyId,
      userId: userId
    };

    this._callService
      .phoneDetails(phoneDetailsPayload)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          this.selectedRecords = response?.data;

          if (this.selectedRecords?.calls?.length > 0) {
            this.selectedRecords.calls = this.selectedRecords.calls.map(
              (call: any, idx: number) => ({
                ...call,
                isSelected: idx === 0
              })
            );

            this.currentSelectedCall = this.selectedRecords.calls[0];
          }

          this.loadCommentsForExpandedRow(phoneNumber);
        },
        (err) => {
          this.showErrorToast('Failed to refresh call details');
        }
      );
  }

  refreshMainList(): void {
    this._callService
      .groupListing(this.recordsFilter)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          this.recordsList = response?.data || [];
          this.hideLoader();
        },
        (err) => {
          this.showErrorToast(`Error fetching records: ${err?.error?.message || err.message}`);
          this.hideLoader();
        }
      );
  }

  closeChangeStatusModal(): void {
    if (this.changeStatusModalRef) {
      this.changeStatusModalRef.close();
    }

    this.currentLeadStatusForModal = '';
    this.newLeadStatus = '';
    this.currentRecordForStatusChange = null;
    this.latestCallId = '';
  }

  toggleCallSelection(call: any, event: Event): void {
    event.stopPropagation();

    const callId = call._id;
    const index = this.selectedCallIds.indexOf(callId);

    if (index > -1) {
      this.selectedCallIds.splice(index, 1);
      const dataIndex = this.selectedCallsData.findIndex((c) => c._id === callId);
      if (dataIndex > -1) {
        this.selectedCallsData.splice(dataIndex, 1);
      }
    } else {
      this.selectedCallIds.push(callId);
      this.selectedCallsData.push(call);
    }
  }

  isCallSelected(callId: string): boolean {
    return this.selectedCallIds.includes(callId);
  }

  clearSelection(): void {
    this.selectedCallIds = [];
    this.selectedCallsData = [];
  }

  getSelectedCount(): number {
    return this.selectedCallIds.length;
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
    if (this.expandedRowIndex !== null) {
      this.collapseRow();
    }
    this.getRecordsList();
    if (this.batchCallModalRef) {
      this.batchCallModalRef.close();
    }
  }

  exportCallList(): void {
    const exportFilter = { ...this.recordsFilter };
    delete exportFilter.skip;
    delete exportFilter.limit;
    exportFilter.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    this.showLoader();

    this._callService
      .exportCall(exportFilter)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
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
          this.showErrorToast(error.message || 'Export failed');
          this.hideLoader();
        }
      );
  }

  hasActiveFilters(): boolean {
    const hasBasicFilters = !!(
      this.selectedAgent ||
      (this.selectedLeadStatus && this.selectedLeadStatus.length > 0) ||
      this.selectedAttempts ||
      this.searchText
    );

    const hasCompanyFilter =
      this.currentUser?.user?.isSuperAdmin &&
      this.currentUser?.user?.isAdmin &&
      this.companyId &&
      this.companyId !== this.currentUser?.user?.companyId;

    const hasUserFilter =
      this.currentUser?.user?.isAdmin && this.userId && this.userId !== this.currentUser?.user?._id;

    const result = hasBasicFilters || hasCompanyFilter || hasUserFilter;
    return result;
  }

  removeFilter(filterType: string): void {
    switch (filterType) {
      case 'agent':
        this.selectedAgent = null;
        delete this.recordsFilter.agentId;
        break;

      case 'leadStatus':
        this.selectedLeadStatus = null;
        delete this.recordsFilter.leadStatus;
        break;

      case 'search':
        this.searchText = '';
        delete this.recordsFilter.search;
        this.clearFilter = !this.clearFilter;
        break;

      case 'company':
        this.companyId = this.currentUser.user.companyId;
        this.recordsFilter.companyId = this.currentUser.user.companyId;
        this.userId = null;
        delete this.recordsFilter.userId;
        this.selectedAgent = null;
        delete this.recordsFilter.agentId;
        break;

      case 'user':
        if (this.companyId === this.currentUser?.user?.companyId) {
          this.userId = this.currentUser.user._id;
          this.recordsFilter.userId = this.currentUser.user._id;
        } else {
          this.userId = this.userListing[0]._id;
          this.recordsFilter.userId = this.userListing[0]._id;
        }
        this.selectedAgent = null;
        delete this.recordsFilter.agentId;
        break;
    }

    this.resetPagination();
    if (this.expandedRowIndex !== null) {
      this.collapseRow();
    }
    this.getRecordsList();
  }

  clearAllFilters(): void {
    this.isClearingFilters = true;

    this.selectedAgent = null;
    this.selectedLeadStatus = null;
    this.selectedAttempts = '';
    this.searchText = '';

    delete this.recordsFilter.agentId;
    delete this.recordsFilter.leadStatus;
    delete this.recordsFilter.search;

    this.companyId = this.currentUser?.user?.companyId || null;
    this.userId = this.currentUser?.user?._id || null;

    if (this.companyId) {
      this.recordsFilter.companyId = this.companyId;
    }
    if (this.userId) {
      this.recordsFilter.userId = this.userId;
    }

    this.clearFilter = !this.clearFilter;
    this.resetPagination();
    this.isClearingFilters = false;

    if (this.currentUser?.user?.isAdmin) {
      this.getUserListing();
    } else {
      this.getAgentList();
    }
  }

  getStatusConfig(status: number) {
    return this._callStatusService.getCallStatus(status, this.callStatus);
  }

  formatDuration(record: any): string {
    return this._timeFormatService.setTime(record);
  }

  formatTimestamp(timestamp: number): string {
    if (!timestamp || !this.currentSelectedCall?.transcript?.[0]?.timestamp) return '00:00';

    const startTime = this.currentSelectedCall.transcript[0].timestamp;
    const elapsedSeconds = Math.floor((timestamp - startTime) / 1000);

    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  getAgentInitials(agentName: string): string {
    if (!agentName || agentName === 'Unknown Agent') {
      return 'UA';
    }

    const words = agentName.replace(/-/g, ' ').split(' ');
    const excludeWords = ['prod', 'dev', 'test', 'v1', 'v2', 'v3', 'v4', 'v5'];
    const filteredWords = words.filter(
      (word) => word && !excludeWords.includes(word.toLowerCase())
    );

    if (filteredWords.length >= 2) {
      return (filteredWords[0][0] + filteredWords[1][0]).toUpperCase();
    } else if (filteredWords.length === 1) {
      return filteredWords[0].substring(0, 2).toUpperCase();
    }

    return 'NA';
  }

  getAgentName(agentId: string): string {
    if (!this.agentList?.length) return agentId;
    const agent = this.agentList.find((a: any) => a.agentId === agentId);
    return agent?.agentName || agentId;
  }

  getCompanyName(companyId: string): string {
    if (!this.companyListing?.length) return companyId;
    const company = this.companyListing.find((c: any) => c._id === companyId);
    return company?.fullName || companyId;
  }

  getUserName(userId: string): string {
    if (!this.userListing?.length) return userId;
    const user = this.userListing.find((u: any) => u._id === userId);
    return user?.fullName || userId;
  }

  getSelectedLeadStatusDisplay(): string {
    if (!this.selectedLeadStatus || this.selectedLeadStatus.length === 0) return '';
    if (this.selectedLeadStatus.length <= 2) {
      return this.selectedLeadStatus.join(', ');
    }
    return `${this.selectedLeadStatus[0]}, ${this.selectedLeadStatus[1]} (+${this.selectedLeadStatus.length - 2})`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
