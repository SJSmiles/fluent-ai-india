import { Component, OnDestroy, TemplateRef, ViewChild, ViewEncapsulation } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { AppComponent } from 'app/app.component';
import { RecordsListComponent } from 'app/src/core/shared-component';
import { BatchCallService } from 'app/src/shared/services/api/batch-call-services';
import { TimeFormatService } from 'app/src/shared/services/time-format.service';
import { Subject, combineLatest, takeUntil } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { CallStatusService } from 'app/src/shared/services/call-status.service';
import { UserService } from 'app/src/shared/services';
import { AuthService } from 'app/src/shared/services/auth/auth-service';
import { BATCH_CALL_STATUS, DELETION_CONFIG } from 'app/src/config/constants/constants';
import { CompanyService } from 'app/src/shared/services/api/company.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { AgentService } from 'app/src/shared/services/api/agent.services';

/**
 * BATCH CALL STATUS CODES:
 * 1 = Draft/Pending
 * 3 = Scheduled
 * 4 = In Progress/Running
 * 5 = Completed/Ended
 * 6 = Failed
 * 7 = Error
 */

@Component({
  selector: 'app-batch-call',
  templateUrl: './batch-call.component.html',
  styleUrls: ['./batch-call.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class BatchCallComponent extends RecordsListComponent<any> implements OnDestroy {
  private destroy$ = new Subject<void>();
  @ViewChild('createBatchCallModel') createBatchCallModel!: TemplateRef<any>;
  @ViewChild('retryBatchCallModel') retryBatchCallModel!: TemplateRef<any>;
  @ViewChild('editBatchModal') editBatchModal!: TemplateRef<any>;
  editBatchForm!: FormGroup;
  editingRecord: any = null;
  editBatchFollowUps: any[] = [];
  batchCallModalRef: NgbModalRef | null = null;
  retryBatchCallModalRef: NgbModalRef | null = null;
  currentDateTime: any;
  isFollowUpRetry: boolean = false;
  batchStatus = BATCH_CALL_STATUS;
  batchDataInput: any;

  currentSort: any;
  selectedRecord: any;
  override currentPageSize: any = 15;
  currentRecordDate: any;
  selectedText: string = '';
  clearFilter: boolean = false;
  currentRecordTime: any;
  combinedDateTime: any;
  userListing: any[] = [];
  userId: string | null = null;
  currentUser: any;
  selectedUserId: string | null = null;
  selectedFollowUps: any;
  currentRecordStatus: any;
  companyListing: any;
  companyId: string | null = null;
  companyListLoaded: boolean = false;
  userListLoaded: boolean = false;
  agentListing: any[] = [];
  agentCount: number = 0;
  agentId: string = '';
  selectedAgentId: string = '';
  agentListLoaded: boolean = false;

  override sortStates: any = {
    name: 'asc',
    utcDateTime: 'desc',
    outboundNumber: 'asc',
    status: 'asc'
  };
  isFollowUpDelete: boolean = false;
  errorText: any;

  // Track original follow-ups and max count
  originalFollowUps: any[] = [];
  maxFollowUpCount: number = 0;

  // Min dates for date pickers (computed properties)
  minDateForBatch: Date = new Date();
  minDateForFollowUp: Date = new Date();
  selectedStatus: number | null = null;

  // Expandable rows state
  expandedRows: { [key: number]: boolean } = {};

  // ==================== CENTRALIZED TIME CONFIGURATION ====================
  private readonly TIME_CONFIG = {
    initialBatchDelayMinutes: 2,
    minTimeBetweenBatchAndFirstFollowupMinutes: 2,
    minTimeBetweenFollowupsMinutes: 10,
    minScheduledTimeMinutes: 2,
    minFollowUpRetryDelayMinutes: 2,
    minBatchRetryDelayMinutes: 2,
    minFollowUpDatePickerMinutes: 2
  };
  // ========================================================================

  constructor(
    private appComponent: AppComponent,
    private _batchCallService: BatchCallService,
    private _modalService: NgbModal,
    private _timeFormatService: TimeFormatService,
    private _router: Router,
    private _activatedRoute: ActivatedRoute,
    private _callStatusService: CallStatusService,
    private _userService: UserService,
    private authService: AuthService,
    private _companyService: CompanyService,
    private _agentService: AgentService,
    private fb: FormBuilder
  ) {
    super(appComponent);
    this.recordsFilter.limit = 15;
    this.recordsFilter.sortBy = 'utcDateTime desc';
    this.currentSort = 'name';

    const currentUserId = this.authService.getCurrentUser()?.user?._id;
    const initialUserId = this._activatedRoute.snapshot.queryParams['userId'] || currentUserId;

    if (!this._activatedRoute.snapshot.queryParams['userId'] && currentUserId) {
      this._router.navigate([`/batch-call/1`], { queryParams: { userId: currentUserId } });
    }

    this.currentDateTime = {
      date: new Date(Date.now() + 11 * 60 * 1000),
      time: new Date().toLocaleTimeString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    this.updateMinDates();

    combineLatest([
      this.authService.currentUser$,
      this._activatedRoute.params,
      this._activatedRoute.queryParams
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([user, params, queryParams]) => {
        this.currentUser = user;

        this.currentPage = parseInt(params['pageNumber'], 10) || 1;
        this.pageIndex = this.currentPage - 1;
        this.recordsFilter.skip = this.pageIndex * this.currentPageSize;

        if (this.currentUser?.user?.isSuperAdmin) {
          const companyIdFromParams = queryParams['companyId'];

          if (companyIdFromParams && companyIdFromParams !== this.companyId) {
            this.companyId = companyIdFromParams;
            this.recordsFilter.companyId = companyIdFromParams;
          } else if (!this.companyId) {
            this.companyId = this.currentUser?.user?.companyId || null;
            if (this.companyId) {
              this.recordsFilter.companyId = this.companyId;
            }
          }

          if (!this.companyListLoaded) {
            this.companyListLoaded = true;
            this.getCompanyListing();
          }

          const userIdFromParams = queryParams['userId'];
          if (userIdFromParams) {
            this.selectedUserId = userIdFromParams;
            this.userId = userIdFromParams;
            this.recordsFilter.userId = userIdFromParams;
          } else {
            this.selectedUserId = null;
            this.userId = null;
          }

          if (!this.userListLoaded) {
            this.userListLoaded = true;
            this.getUserListing();
          }
        } else if (this.currentUser?.user?.isAdmin) {
          if (!this.companyId) {
            this.companyId = this.currentUser?.user?.companyId || null;
            if (this.companyId) {
              this.recordsFilter.companyId = this.companyId;
            }
          }

          const userIdFromParams = queryParams['userId'];
          if (userIdFromParams) {
            this.selectedUserId = userIdFromParams;
            this.userId = userIdFromParams;
            this.recordsFilter.userId = userIdFromParams;
          } else {
            this.selectedUserId = this.currentUser?.user?._id;
            this.userId = this.selectedUserId;
            this.recordsFilter.userId = this.selectedUserId;
          }

          if (!this.userListLoaded) {
            this.userListLoaded = true;
            this.getUserListing();
          }
        }

        const agentIdFromParams = queryParams['agentId'];
        if (agentIdFromParams) {
          this.selectedAgentId = agentIdFromParams;
          this.agentId = agentIdFromParams;
          this.recordsFilter.agentId = agentIdFromParams;
        } else {
          this.selectedAgentId = '';
          this.agentId = '';
          delete this.recordsFilter.agentId;
        }

        const statusFromParams = queryParams['status'];
        if (statusFromParams) {
          this.selectedStatus = parseInt(statusFromParams, 10);
          this.recordsFilter.status = this.selectedStatus;
        } else {
          this.selectedStatus = null;
          delete this.recordsFilter.status;
        }

        if (!this.agentListLoaded) {
          this.agentListLoaded = true;
          this.getAgentListing();
        }
      });

    this.initEditForm();
  }

  // ==================== HELPER METHODS FOR NEW DESIGN ====================

  getAgentInitials(record: any): string {
    const name = record.agentName || 'Unknown';
    const parts = name.split(/[\s\-_]+/).filter((part: string | any[]) => part.length > 0);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 1).toUpperCase();
  }

  getProgressPercentage(record: any): number {
    if (!record.totalRecipient || record.totalRecipient === 0) {
      return 0;
    }
    return Math.round((record.processedRecipient / record.totalRecipient) * 100);
  }

  getStatusBadgeClass(record: any): string {
    const statusConfig = this.getRecordStatusConfig(record);
    const label = statusConfig.label?.toUpperCase();

    if (label === 'SCHEDULED' || label === 'QUEUED') {
      return 'badge-neutral';
    } else if (label === 'IN PROGRESS' || label === 'RUNNING') {
      return 'badge-running';
    } else if (label === 'COMPLETED' || label === 'ENDED') {
      return 'badge-success';
    } else if (label === 'FAILED' || label === 'ERROR') {
      return 'badge-error';
    }

    return 'badge-neutral';
  }

  getFollowUpStatusBadgeClass(record: any): string {
    const statusConfig = this.getFollowUpStatusConfig(record);
    const label = statusConfig.label?.toUpperCase();

    if (label === 'SCHEDULED' || label === 'QUEUED') {
      return 'badge-neutral';
    } else if (label === 'IN PROGRESS' || label === 'RUNNING') {
      return 'badge-running';
    } else if (label === 'COMPLETED' || label === 'ENDED') {
      return 'badge-success';
    } else if (label === 'FAILED' || label === 'ERROR') {
      return 'badge-error';
    }

    return 'badge-neutral';
  }

  // Expandable row methods
  toggleExpand(index: number, event: Event) {
    event.stopPropagation();

    // Close all other expanded rows
    Object.keys(this.expandedRows).forEach((key) => {
      const keyIndex = parseInt(key, 10);
      if (keyIndex !== index) {
        this.expandedRows[keyIndex] = false;
      }
    });

    // Toggle current row
    this.expandedRows[index] = !this.expandedRows[index];

    // If expanding, scroll to the expanded content after a brief delay
    if (this.expandedRows[index]) {
      setTimeout(() => {
        const expandedRow = document.querySelector(`.expanded-content-${index}`);
        if (expandedRow) {
          expandedRow.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
          });

          // Add focus class for 1 second
          expandedRow.classList.add('focused');
          setTimeout(() => {
            expandedRow.classList.remove('focused');
          }, 1000);
        }
      }, 100); // Small delay to ensure DOM is updated
    }
  }

  hasFollowups(record: any): boolean {
    return record.followups && record.followups.length > 0;
  }

  getFollowupCount(record: any): number {
    return record.followups ? record.followups.length : 0;
  }

  getFailedFollowUpCount(record: any): number {
    if (!record.followups || record.followups.length === 0) {
      return 0;
    }
    return record.followups.filter((f: any) => f.status === 6).length;
  }

  hasFailedFollowUps(record: any): boolean {
    return this.getFailedFollowUpCount(record) > 0;
  }

  getFollowUpLabel(index: number): string {
    if (index === 0) return 'First Follow-Up';
    if (index === 1) return 'Second Follow-Up';
    if (index === 2) return 'Third Follow-Up';
    return `${index + 1}th Follow-Up`;
  }

  /**
   * Check if retry button should be visible for a follow-up
   * Conditions:
   * 1. Follow-up must be failed (status === 6)
   * 2. Parent batch must be running (status === 4) OR completed (status === 5)
   * 3. Parent batch must NOT be failed (status !== 6)
   */
  shouldShowFollowUpRetry(parentRecord: any, followup: any): boolean {
    const followupIsFailed = followup.status === 6;
    const parentIsRunningOrCompleted = parentRecord.status === 4 || parentRecord.status === 5;
    const parentIsNotFailed = parentRecord.status !== 6;

    return followupIsFailed && parentIsRunningOrCompleted && parentIsNotFailed;
  }

  /**
   * Check if parent batch is in a valid state for follow-up retry
   */
  isParentBatchRunning(record: any): boolean {
    // Allow retry if batch is running (4) or completed (5)
    // but NOT if batch itself is failed (6) or has errors (7)
    return record.status === 4 || record.status === 5;
  }

  // ==================== END HELPER METHODS ====================

  private updateMinDates(): void {
    this.minDateForBatch = new Date(
      Date.now() + this.TIME_CONFIG.minBatchRetryDelayMinutes * 60 * 1000
    );
    this.minDateForFollowUp = new Date(
      Date.now() + this.TIME_CONFIG.minFollowUpDatePickerMinutes * 60 * 1000
    );
  }

  initEditForm() {
    this.editBatchForm = this.fb.group({
      batchDate: [null],
      batchTime: [null],
      followUpsDetails: [[]]
    });
  }

  getRecordsList(emptyList = false): void {
    this.showLoader();
    this._batchCallService
      .listing(this.recordsFilter)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          this.recordsList = response?.data || [];
          this.totalCount = response?.totalCount;
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

  sortActive(field: any) {
    const currentDirection = this.sortStates[field] || '';
    const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
    Object.keys(this.sortStates).forEach((k) => (this.sortStates[k] = ''));
    this.sortStates[field] = newDirection;
    this.currentSort = field;
    this.recordsFilter.sortBy = `${field} ${newDirection}`;
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 15;
    this.currentPage = 1;
    this.getRecordsList();

    this.navigateWithFilters();
  }

  override pageChanged(pageNumber: number): void {
    this.currentPage = pageNumber;
    this.pageIndex = pageNumber - 1;
    this.recordsFilter.skip = this.pageIndex * this.currentPageSize;
    this.getRecordsList();

    this.navigateWithFilters(pageNumber);
  }

  private navigateWithFilters(pageNumber: number = 1): void {
    const queryParams: any = {};

    if (this.selectedUserId) {
      queryParams.userId = this.selectedUserId;
    }

    if (this.currentUser?.user?.isSuperAdmin && this.companyId) {
      queryParams.companyId = this.companyId;
    }

    if (this.selectedAgentId) {
      queryParams.agentId = this.selectedAgentId;
    }

    if (this.selectedStatus !== null && this.selectedStatus !== undefined) {
      queryParams.status = this.selectedStatus;
    }

    this._router.navigate([`/batch-call/${pageNumber}`], { queryParams });
  }

  createBatchCall() {
    if (this.currentUser?.user?.bmbyConfig && !this.currentUser?.user?.profileCompletion) {
      if (this.currentUser?.user?.isAdmin) {
        this.showErrorToast('please complete user bmby profile first to create batch');
      } else {
        this.showErrorToast(
          'Please contact your administration to complete your user bmby profile first to create batch'
        );
      }
      return;
    }
    this.batchCallModalRef = this._modalService.open(this.createBatchCallModel, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
      windowClass: 'custom-lead-modal'
    });
  }

  retryBatchCall(record: any) {
    if (this.currentUser?.user?.bmbyConfig && !this.currentUser?.user?.profileCompletion) {
      if (this.currentUser?.user?.isAdmin) {
        this.showErrorToast('please complete user bmby profile first to create batch');
      } else {
        this.showErrorToast(
          'Please contact your administration to complete your user bmby profile first to create batch'
        );
      }
      return;
    }
    this.batchDataInput = record;
    this.retryBatchCallModalRef = this._modalService.open(this.retryBatchCallModel, {
      centered: true,
      size: 'xl',
      backdrop: 'static',
      windowClass: 'custom-lead-modal'
    });
  }

  statusUpdate() {
    const payload = {
      date: this.currentRecordDate,
      time: this.currentRecordTime
    };
    this.showLoader();
    this._batchCallService.statusUpdate(this.selectedRecord?._id, payload).subscribe(
      async () => {
        this.showSuccessToast('Status Updated Successfully');
        this.getRecordsList();
        this._modalService.dismissAll();
      },
      (err) => {
        this.showErrorToast(`Error in record fetching: ${err.error?.message || err.message}`);
        this.hideLoader();
      }
    );
  }

  retryCallEvent(event: any) {
    this.getRecordsList();
  }

  openConfirmationModal(content: any, record: any) {
    this.selectedRecord = record;
    this.currentRecordDate = record.date;
    this.currentRecordTime = record.time;
    this.combinedDateTime = `${record.date} ${record.time}`;
    this._modalService
      .open(content, { windowClass: 'custom-status-modal', centered: true })
      .result.then();
  }

  customSearch(searchStr: string) {
    if (searchStr) {
      this.recordsFilter.searchStr = searchStr;
    } else {
      delete this.recordsFilter.searchStr;
    }
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 15;
    this.currentPage = 1;
    this.getRecordsList();

    this.navigateWithFilters();
  }

  onDateSelected(event: Date) {
    let selectedDate = new Date(event);
    const formattedDate = this._timeFormatService.formatDateToYYYYMMDD(selectedDate);
    const timeOnly = selectedDate.toTimeString().slice(0, 5);
    this.currentRecordDate = formattedDate;
    this.currentRecordTime = timeOnly;
  }

  openBatchDetails(record: any) {
    const userIdToPass =
      this.selectedUserId || this.currentUser?.user?._id || this.currentUser?.user?.id;

    this._router.navigate([`/batch-call/${this.currentPage}/details`, record._id], {
      queryParams: {
        userId: userIdToPass,
        companyId: this.companyId || this.currentUser?.user?.companyId
      }
    });
  }

  getRecordStatusConfig(record: any) {
    return this._callStatusService.getRecordStatusConfig(record);
  }

  getFollowUpStatusConfig(record: any) {
    return this._callStatusService.getFollowUpStatusConfig(record);
  }

  batchCallCreateEvent() {
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 15;
    this.currentPage = 1;
    this.getRecordsList();

    this.navigateWithFilters();
  }

  selectUser(event: any) {
    const selectedId = event?.value || event?._id || event?.id || event;

    if (selectedId && selectedId !== this.currentUser?.user?._id) {
      this.selectedUserId = selectedId;
    } else if (!selectedId || selectedId === '') {
      this.selectedUserId = null;
      this.userId = null;
      delete this.recordsFilter.userId;
    } else {
      this.selectedUserId = selectedId;
    }

    this.userId = this.selectedUserId;

    if (this.selectedUserId) {
      this.recordsFilter.userId = this.selectedUserId;
    } else {
      delete this.recordsFilter.userId;
    }

    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 15;
    this.currentPage = 1;

    this.agentListLoaded = false;
    this.selectedAgentId = '';
    this.agentId = '';
    delete this.recordsFilter.agentId;
    this.getAgentListing();

    this.navigateWithFilters();
  }

  getUserListing() {
    if (!this.currentUser?.user?.isAdmin) {
      return;
    }
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
          if (this.currentUser?.user?.isSuperAdmin) {
            if (!this.selectedUserId) {
              this.userId = this.userListing[0]._id;
              this.recordsFilter.userId = this.userId;
              this.selectedUserId = this.userId;
              this.getAgentListing();
            }
          } else if (this.currentUser?.user?.isAdmin) {
            if (!this.selectedUserId) {
              this.selectedUserId = this.currentUser?.user?._id;
              this.userId = this.selectedUserId;
              this.recordsFilter.userId = this.selectedUserId;
            }
          }
        }

        this.hideLoader();
      },
      (err) => {
        this.showErrorToast(`Error fetching users: ${err.error?.message || err.message}`);
        this.hideLoader();
      }
    );
  }

  followupDetails(content: any, event: any, record: any) {
    event.stopPropagation();

    if (record?.followups && record?.followups?.length > 0) {
      this.selectedFollowUps = record?.followups;
      this.currentRecordStatus = record?.status;
      this._modalService
        .open(content, {
          windowClass: 'custom-status-modal',
          size: 'xl',
          backdrop: 'static',
          centered: true
        })
        .result.then();
    }
  }

  openDeleteConfirmationModal(content: any, record: any) {
    this.currentRecord = record;
    this.currentRecordStatus = record?.status;
    this.isFollowUpDelete = false;
    this._modalService.open(content, {
      windowClass: 'custom-team-modal',
      centered: true,
      backdrop: 'static'
    });
  }

  openFollowUpDeleteConfirmationModal(content: any, record: any) {
    this.currentRecord = record;
    const name = 'Followup call';
    this.currentRecord.name = name;
    this.isFollowUpDelete = true;
    this._modalService.open(content, {
      windowClass: 'custom-team-modal',
      centered: true,
      backdrop: 'static'
    });
  }

  private canDelete(record: any): boolean {
    if (this.currentRecordStatus === 1) {
      return true;
    }

    const currentTime = new Date();
    const recordTime = new Date(record.utcDateTime);
    const timeDifference = Math.abs(recordTime.getTime() - currentTime.getTime());

    return timeDifference >= DELETION_CONFIG.MIN_TIME_DIFFERENCE_MS;
  }

  async deleteRecord(modal: any, record: any) {
    if (!this.canDelete(this.currentRecord)) {
      this.showErrorToast(
        `Cannot delete: The record can only be deleted if there is at least ${DELETION_CONFIG.MIN_TIME_DIFFERENCE_MINUTES} minutes difference from the scheduled time.`
      );
      return;
    }

    this.showLoader();
    try {
      const payload = {
        _id: this.currentRecord._id,
        type: this.isFollowUpDelete ? 'followups' : 'batch'
      };
      await this._batchCallService.deleteCall(payload).toPromise();
      const successMessage = this.isFollowUpDelete
        ? 'Follow-up deleted successfully!'
        : 'Batch call deleted successfully!';
      this.showSuccessToast(successMessage);
      this.getRecordsList();
      if (this.isFollowUpDelete) {
        this.selectedFollowUps = this.selectedFollowUps.filter(
          (f: any) => f._id !== this.currentRecord._id
        );
      }
      modal.close();
      this.hideLoader();
    } catch (error: any) {
      const errorMessage = this.isFollowUpDelete
        ? 'Error while deleting the follow-up:'
        : 'Error while deleting the batch call:';
      this.showErrorToast(`${errorMessage} ${error.error?.message || error.message}`);
      this.hideLoader();
    }
  }

  selectCompany(event: any) {
    if (event) {
      this.recordsFilter.companyId = event;
      this.companyId = event;
    } else {
      delete this.recordsFilter.companyId;
      this.companyId = null;
    }

    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 15;
    this.currentPage = 1;

    if (this.currentUser?.user?.isSuperAdmin) {
      this.selectedUserId = null;
      this.userId = null;
      delete this.recordsFilter.userId;

      this.selectedAgentId = '';
      this.agentId = '';
      delete this.recordsFilter.agentId;
      this.agentListLoaded = false;

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
        this.hideLoader();
      },
      (err) => {
        this.showErrorToast(`Error in record fetching: ${err.error?.message || err.message}`);
        this.hideLoader();
      }
    );
  }

  openFailedModal(content: any, errorMessage: any) {
    this.errorText = errorMessage;
    this._modalService.open(content, { size: 'md', centered: true });
  }

  checkRecordValidity(record: any): boolean {
    if (record.status === 1) {
      return true;
    }
    if (record.schedule) {
      const recordDateTime = new Date(`${record.date} ${record.time}`);
      const nowPlus30 = new Date(Date.now() + 30 * 60000);

      return recordDateTime > nowPlus30;
    }
    return false;
  }

  // ==================== MODAL & FOLLOW-UP METHODS ====================

  openEditBatchModal(content: any, record: any, isFollowUpRetryMode: boolean = false) {
    this.editingRecord = { ...record };
    this.isFollowUpRetry = isFollowUpRetryMode;

    this.updateMinDates();

    this.originalFollowUps = record.followups ? [...record.followups] : [];
    this.maxFollowUpCount = this.originalFollowUps.length;

    // Set batch date and time
    const futureDate = new Date(Date.now() + this.TIME_CONFIG.initialBatchDelayMinutes * 60 * 1000);
    const batchDate = this._timeFormatService.formatDateToYYYYMMDD(futureDate);
    const batchTime = futureDate.toTimeString().slice(0, 5);

    this.editBatchForm.patchValue({
      batchDate: batchDate,
      batchTime: batchTime
    });

    // Prepare follow-ups with separate date and time
    this.editBatchFollowUps = [];
    if (record.followups && record.followups.length > 0) {
      let followUpsToProcess = record.followups;

      if (isFollowUpRetryMode) {
        followUpsToProcess = record.followups.filter((f: any) => f.status === 6);
      }

      this.editBatchFollowUps = followUpsToProcess.map((followUp: any, index: number) => {
        const followUpTime = new Date(
          futureDate.getTime() +
            (index + 1) * this.TIME_CONFIG.minTimeBetweenFollowupsMinutes * 60 * 1000
        );

        return {
          ...followUp,
          date: this._timeFormatService.formatDateToYYYYMMDD(followUpTime),
          time: followUpTime.toTimeString().slice(0, 5),
          isDeleted: false
        };
      });
    }

    this._modalService.open(content, {
      size: 'lg',
      centered: true,
      backdrop: 'static'
    });
  }

  deleteFollowUp(index: number) {
    if (this.editBatchFollowUps[index]) {
      this.editBatchFollowUps[index].isDeleted = true;
    }
  }

  refreshFollowUps() {
    const batchDate = this.editBatchForm.get('batchDate')?.value;
    const batchTime = this.editBatchForm.get('batchTime')?.value;
    const batchDateTime = new Date(`${batchDate}T${batchTime}:00`);

    this.editBatchFollowUps.forEach((followUp: any, index: number) => {
      const followUpTime = new Date(
        batchDateTime.getTime() +
          (index + 1) * this.TIME_CONFIG.minTimeBetweenFollowupsMinutes * 60 * 1000
      );

      followUp.date = this._timeFormatService.formatDateToYYYYMMDD(followUpTime);
      followUp.time = followUpTime.toTimeString().slice(0, 5);
      followUp.isDeleted = false;
    });

    this.showSuccessToast('Follow-ups refreshed to default schedule');
  }

  getActiveFollowUps(): any[] {
    return this.editBatchFollowUps.filter((f) => !f.isDeleted);
  }

  getDeletedFollowUpCount(): number {
    return this.editBatchFollowUps.filter((f) => f.isDeleted).length;
  }

  hasDeletedFollowUps(): boolean {
    return this.getDeletedFollowUpCount() > 0;
  }

  saveEditedBatchCall() {
    const formValue = this.editBatchForm.value;
    const activeFollowUps = this.getActiveFollowUps();

    // Validation
    if (!this.isFollowUpRetry && (!formValue.batchDate || !formValue.batchTime)) {
      this.showErrorToast('Batch retry date and time are required');
      return;
    }

    if (this.isFollowUpRetry && activeFollowUps.length === 0) {
      this.showErrorToast('No failed follow-ups to retry');
      return;
    }

    if (activeFollowUps.length > 0) {
      if (!this.validateEditFollowUpGaps()) {
        return;
      }
    }

    // Validate scheduled time is in future
    if (!this.isFollowUpRetry && formValue.batchDate && formValue.batchTime) {
      const scheduledDateTime = new Date(`${formValue.batchDate}T${formValue.batchTime}:00`);
      const minScheduledTime = new Date(
        Date.now() + this.TIME_CONFIG.minScheduledTimeMinutes * 60 * 1000
      );

      if (scheduledDateTime < minScheduledTime) {
        this.showErrorToast(
          `Scheduled time must be at least ${this.TIME_CONFIG.minScheduledTimeMinutes} minutes from current time`
        );
        return;
      }
    }

    this.showLoader();

    if (this.isFollowUpRetry) {
      // Follow-up retry API call
      const payload: any = {
        id: this.editingRecord._id,
        timezone: this.currentDateTime?.timezone || 'Asia/Calcutta',
        followupDetails: activeFollowUps.map((followUp: any) => ({
          id: followUp._id,
          date: followUp.date,
          time: followUp.time
        }))
      };

      this._batchCallService.updateFollowupCall(payload).subscribe(
        (response: any) => {
          this.showSuccessToast('Follow-up retry scheduled successfully');
          this.getRecordsList();
          this._modalService.dismissAll();
          this.hideLoader();
        },
        (err) => {
          this.showErrorToast(
            `Error scheduling follow-up retry: ${err.error?.message || err.message}`
          );
          this.hideLoader();
        }
      );
    } else {
      // Batch retry API call
      const payload: any = {
        id: this.editingRecord._id,
        schedule: true,
        date: formValue.batchDate,
        time: formValue.batchTime,
        timezone: this.currentDateTime?.timezone || 'Asia/Calcutta'
      };

      if (activeFollowUps.length > 0) {
        payload.followupDetails = activeFollowUps.map((followUp: any) => ({
          id: followUp._id,
          date: followUp.date,
          time: followUp.time
        }));
      }

      this._batchCallService.updateBatchCall(payload).subscribe(
        (response: any) => {
          this.showSuccessToast('Batch call updated successfully');
          this.getRecordsList();
          this._modalService.dismissAll();
          this.hideLoader();
        },
        (err) => {
          this.showErrorToast(`Error updating batch call: ${err.error?.message || err.message}`);
          this.hideLoader();
        }
      );
    }
  }

  private get minTimeDifferenceMs(): number {
    return this.TIME_CONFIG.minTimeBetweenFollowupsMinutes * 60 * 1000;
  }

  private get timeDifferenceDescription(): string {
    const minutes = this.TIME_CONFIG.minTimeBetweenFollowupsMinutes;
    if (minutes < 60) {
      return minutes === 1 ? '1 minute' : `${minutes} minutes`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      return hours === 1 ? '1 hour' : `${hours} hours`;
    } else {
      const days = Math.floor(minutes / 1440);
      return days === 1 ? '1 day' : `${days} days`;
    }
  }

  validateEditFollowUpGaps(): boolean {
    const activeFollowUps = this.getActiveFollowUps();

    if (activeFollowUps.length === 0) {
      return true;
    }

    // Validate first follow-up
    const firstFollowUp = activeFollowUps[0];

    if (!firstFollowUp.date || !firstFollowUp.time) {
      this.showErrorToast('First follow-up date and time are required');
      return false;
    }

    const firstFollowUpDateTime = new Date(`${firstFollowUp.date}T${firstFollowUp.time}:00`);

    if (isNaN(firstFollowUpDateTime.getTime())) {
      this.showErrorToast('Invalid follow-up date or time format');
      return false;
    }

    let compareDateTime: Date;
    let compareLabel: string;

    if (this.isFollowUpRetry) {
      compareDateTime = new Date();
      compareLabel = 'current time';
    } else {
      const batchDate = this.editBatchForm.get('batchDate')?.value;
      const batchTime = this.editBatchForm.get('batchTime')?.value;

      if (batchDate && batchTime) {
        compareDateTime = new Date(`${batchDate}T${batchTime}:00`);
        compareLabel = 'scheduled batch call time';

        if (isNaN(compareDateTime.getTime())) {
          this.showErrorToast('Invalid scheduled date or time format');
          return false;
        }
      } else {
        this.showErrorToast('Scheduled date and time are required');
        return false;
      }
    }

    const timeDiffMs = firstFollowUpDateTime.getTime() - compareDateTime.getTime();

    if (timeDiffMs < 0) {
      this.showErrorToast(`First follow-up cannot be scheduled before ${compareLabel}`);
      return false;
    }

    const minFirstFollowUpMs =
      this.TIME_CONFIG.minTimeBetweenBatchAndFirstFollowupMinutes * 60 * 1000;
    if (timeDiffMs < minFirstFollowUpMs) {
      this.showErrorToast(
        `First follow-up must be at least ${this.TIME_CONFIG.minTimeBetweenBatchAndFirstFollowupMinutes} minutes after ${compareLabel}`
      );
      return false;
    }

    // Validate all follow-ups have date and time
    for (let i = 0; i < activeFollowUps.length; i++) {
      const followUp = activeFollowUps[i];

      if (!followUp.date || followUp.date === '' || followUp.date.trim() === '') {
        this.showErrorToast(`Follow-up ${i + 1} is missing a date`);
        return false;
      }
      if (!followUp.time || followUp.time === '' || followUp.time.trim() === '') {
        this.showErrorToast(`Follow-up ${i + 1} is missing a time`);
        return false;
      }
    }

    // Validate gaps between consecutive follow-ups
    if (activeFollowUps.length > 1) {
      for (let i = 0; i < activeFollowUps.length - 1; i++) {
        const current = activeFollowUps[i];
        const next = activeFollowUps[i + 1];

        const currentDateTime = new Date(`${current.date}T${current.time}:00`);
        const nextDateTime = new Date(`${next.date}T${next.time}:00`);

        const timeDiffMs = nextDateTime.getTime() - currentDateTime.getTime();

        if (timeDiffMs < this.minTimeDifferenceMs) {
          this.showErrorToast(
            `Follow-up ${i + 2} must be at least ${this.timeDifferenceDescription} after Follow-up ${i + 1}`
          );
          return false;
        }
      }
    }

    return true;
  }

  openFollowUpRetryFromModal(content: any, parentRecord: any) {
    // Validate parent batch status
    if (!this.isParentBatchRunning(parentRecord)) {
      this.showErrorToast('Cannot retry follow-ups when parent batch has failed');
      return;
    }

    // Filter only failed follow-ups
    const failedFollowUps = parentRecord.followups?.filter((f: any) => f.status === 6) || [];

    if (failedFollowUps.length === 0) {
      this.showErrorToast('No failed follow-ups to retry');
      return;
    }

    // Open the edit modal in follow-up retry mode
    this.openEditBatchModal(content, parentRecord, true);
  }

  // ==================== AGENT METHODS ====================

  getAgentListing() {
    this.showLoader();

    const filterParams: any = {};

    if (this.currentUser?.user?.isSuperAdmin && this.companyId) {
      filterParams.companyId = this.companyId;
    } else if (this.currentUser?.user?.companyId) {
      filterParams.companyId = this.currentUser.user.companyId;
    }

    if (this.selectedUserId && this.selectedUserId !== '') {
      filterParams.userId = this.selectedUserId;
    }

    this._agentService.filterListing(filterParams).subscribe(
      (response: any) => {
        this.agentListing = response?.data || [];
        this.agentCount = response?.totalCount || 0;

        if (this.agentListing.length > 0 && this.selectedAgentId) {
          const agentExists = this.agentListing.some(
            (agent: any) => agent._id === this.selectedAgentId
          );
          if (!agentExists) {
            this.selectedAgentId = '';
            this.agentId = '';
            delete this.recordsFilter.agentId;
          }
        }

        this.getRecordsList();
        this.hideLoader();
      },
      (err) => {
        const errorMessage = err.error?.message || err.message || 'Failed to fetch agents';
        this.showErrorToast(`Error fetching agents: ${errorMessage}`);
        this.agentListing = [];
        this.agentCount = 0;
        this.hideLoader();
      }
    );
  }

  selectAgent(event: any) {
    const selectedId = event?.target?.value || event?.value || event?._id || event;

    if (!selectedId || selectedId === '' || selectedId === 'null') {
      this.selectedAgentId = '';
      this.agentId = '';
      delete this.recordsFilter.agentId;
    } else {
      this.selectedAgentId = selectedId;
      this.agentId = selectedId;
      this.recordsFilter.agentId = selectedId;
    }

    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 15;
    this.currentPage = 1;

    this.getRecordsList();

    this.navigateWithFilters();
  }

  selectStatus(event: any) {
    const selectedValue = event?.target?.value || event?.value || event;

    if (!selectedValue || selectedValue === '' || selectedValue === 'null') {
      this.selectedStatus = null;
      delete this.recordsFilter.status;
    } else {
      this.selectedStatus = parseInt(selectedValue, 10);
      this.recordsFilter.status = this.selectedStatus;
    }

    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 15;
    this.currentPage = 1;

    this.getRecordsList();

    this.navigateWithFilters();
  }
}
