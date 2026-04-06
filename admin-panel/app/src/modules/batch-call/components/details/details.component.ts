import { Component, OnDestroy, TemplateRef, ViewChild, ViewEncapsulation } from '@angular/core';
import { AppComponent } from 'app/app.component';
import { RecordsListComponent } from 'app/src/core/shared-component';
import { BatchCallService } from 'app/src/shared/services/api/batch-call-services';
import { Subject, takeUntil, interval } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { CallStatusService } from 'app/src/shared/services/call-status.service';
import { BATCH_DETAILS, CALL_STATUS, Lead_Status } from 'app/src/config/constants/constants';
import { TimeFormatService } from 'app/src/shared/services/time-format.service';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

// ============================================================================
// ADD THIS CONSTANT AT THE TOP (or import from constants file)
// ============================================================================
export const RECIPIENTS_CALL_STATUS = {
  PENDING: 1,
  UN_SUCCESS: 2,
  SUCCESS: 3,
  DEAD: 4,
  SKIP: 5,
  IN_PROCESS: 6,
  FAILED: 7
};

@Component({
  selector: 'app-batch-call-details',
  templateUrl: './details.component.html',
  styleUrls: ['./details.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class BatchCallDetailsComponent extends RecordsListComponent<any> implements OnDestroy {
  @ViewChild('confirmationModal') confirmationModal!: TemplateRef<any>;
  @ViewChild('confirmationMarkBatchCompleteModal')
  confirmationMarkBatchCompleteModal!: TemplateRef<any>;

  private destroy$ = new Subject<void>();
  private refreshInterval$ = new Subject<void>();
  batchCallModalRef: NgbModalRef | null = null;
  autoRefreshEnabled = true;

  batch_Details = BATCH_DETAILS;
  // Component state
  currentSort: any;
  batchListing: any;
  override currentPageSize: any = 15;
  callStatus = CALL_STATUS;
  batchIds: any = [];
  leadStatusList = Lead_Status;
  currentBatchCallPage: number = 1;
  userId: string | null = null;
  companyId: string | null = null;
  isVisibleRetryButton = false;
  completeBatchMarked = false;
  maxRecord: any = null;
  currentFocusedRow: number | null = null;

  // UI state
  expandedRows: { [key: number]: boolean } = {};
  currentFilter: string = 'all';
  searchText: string = '';
  selectedBatchId: any = null;
  selectedLeadStatus: any = null;
  selectedText: string = '';
  clearFilter: boolean = false;

  // Batch info
  batchName: string = '';
  batchCode: string = '';
  agentName: string = '';
  scheduledFor: string = '';
  startedAt: string = '';
  runningFor: string = '';

  // Statistics from API
  analysisData: any = {
    total: 0,
    complete: 0,
    processing: 0,
    queued: 0,
    meeting: 0,
    followUps: 0,
    skip: 0,
    failed: 0
  };

  constructor(
    private appComponent: AppComponent,
    private _batchCallService: BatchCallService,
    private _routeService: ActivatedRoute,
    private _callStatusService: CallStatusService,
    private _timeFormatService: TimeFormatService,
    private _router: Router,
    private _modalService: NgbModal
  ) {
    super(appComponent);
    this.recordsFilter.limit = 15;
    this.recordsFilter.sortBy = 'callCreatedAt desc';
    this.currentSort = 'callCreatedAt';

    this.initializeComponent();
    this.startAutoRefresh();
  }

  private startAutoRefresh(): void {
    interval(120000)
      .pipe(takeUntil(this.destroy$), takeUntil(this.refreshInterval$))
      .subscribe(() => {
        if (this.autoRefreshEnabled) {
          this.getRecordsList(true);
        }
      });
  }

  private initializeComponent() {
    const queryParams = this._routeService.snapshot.queryParams;

    if (queryParams['userId']) {
      this.userId = queryParams['userId'];
    }

    if (queryParams['companyId']) {
      this.companyId = queryParams['companyId'];
    }

    const params = this._routeService.snapshot.params;
    this.batchIds = params['id'];
    this.selectedBatchId = this.batchIds;
    this.recordsFilter.batchIds = this.batchIds;
    this.currentBatchCallPage = parseInt(params['pageNumber']) || 1;

    this.getBatchListing();

    this._routeService.params.subscribe((params) => {
      this.batchIds = params['id'];
      this.recordsFilter.batchIds = this.batchIds;
      this.currentBatchCallPage = parseInt(params['pageNumber']) || 1;
    });

    this._routeService.queryParams.subscribe((queryParams) => {
      const newUserId = queryParams['userId'] || null;
      this.recordsFilter.userId = this.userId;
      if (newUserId !== this.userId) {
        this.userId = newUserId;
        this.getBatchListing();
      }
    });
  }

  override sortStates: any = {
    name: 'asc',
    callCreatedAt: 'desc',
    batchName: 'asc',
    callDuration: 'asc',
    callStatus: 'asc',
    callLeadStatus: 'asc',
    callAttempt: 'asc'
  };

  getBatchListing() {
    this.showLoader();

    const batchFilter = this.userId ? { userId: this.userId, companyId: this.companyId } : {};

    this._batchCallService.filterListing(batchFilter).subscribe(
      async (response: any) => {
        this.batchListing = response?.data;
        this.getRecordsList();
      },
      (err) => {
        this.showErrorToast(`Error in record fetching: ${err.error?.message || err.message}`);
        this.hideLoader();
      }
    );
  }

  getRecordsList(isBackgroundRefresh: boolean = false): void {
    if (!isBackgroundRefresh) {
      this.showLoader();
    }

    this._batchCallService
      .details(this.recordsFilter)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          // Extract data from API response
          this.recordsList = response?.data || [];
          this.totalCount = response?.totalCount || 0;

          // Store analysis data from API
          if (response?.analysis) {
            this.analysisData = {
              total: response.analysis.total || 0,
              complete: response.analysis.complete || 0,
              processing: response.analysis.processing || 0,
              queued: response.analysis.queued || 0,
              meeting: response.analysis.meeting || 0,
              followUps: response.analysis.followUps || 0,
              skip: response.analysis.skip || 0,
              failed: response.analysis.failed || 0
            };
          }

          const responseLogs = response?.logs || null;

          // Process call history for each record to match template expectations
          this.recordsList = this.recordsList.map((record: any) => {
            if (record.callHistory && record.callHistory.length > 0) {
              record.callHistory = record.callHistory.map((attempt: any) => {
                return {
                  ...attempt,
                  // Map attempt data to template-expected format
                  result: this.mapAttemptResult(record.recipientStatus, attempt),
                  status:
                    attempt.status ||
                    this.getStatusFromDisconnectionReason(attempt.disconnectionReason)
                };
              });
            }
            return record;
          });

          // Extract batch info from first record
          if (this.recordsList.length > 0) {
            const firstRecord = this.recordsList[0];
            this.batchName = firstRecord.batchName || 'Batch Details';
            this.batchCode = `BCH-${firstRecord.batchId?.slice(-8)?.toUpperCase() || 'XXXX'}`;
            this.agentName = firstRecord.callAgentId || 'Not Assigned';

            if (firstRecord.utcDateTime) {
              const dateTime = new Date(firstRecord.utcDateTime);
              this.scheduledFor = dateTime.toLocaleString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });
            }

            if (firstRecord.actualStartDateTime) {
              const startTime = new Date(firstRecord.actualStartDateTime);
              this.startedAt = startTime.toLocaleString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });
              this.runningFor = this.calculateRunningTime(
                startTime,
                firstRecord.batchStatus,
                firstRecord.updatedAt
              );
            }
          }

          if (!isBackgroundRefresh) {
            this.hideLoader();
          }
          this.retryButtonCondition(this.recordsList, responseLogs);
        },
        (err) => {
          if (!isBackgroundRefresh) {
            this.showErrorToast(`Error in record fetching ${err?.error?.message}`);
            this.hideLoader();
          }
        }
      );
  }

  // ============================================================================
  // FIXED: Helper method to map attempt result based on recipientStatus
  // ============================================================================
  private mapAttemptResult(recipientStatus: number, attempt: any): string {
    if (recipientStatus === RECIPIENTS_CALL_STATUS.SUCCESS) {
      // Completed
      if (
        attempt.disconnectionReason === 'dial_no_answer' ||
        attempt.disconnectionReason === 'dial_busy' ||
        attempt.disconnectionReason === 'dial_failed'
      ) {
        return 'followup';
      }
      return 'success';
    } else if (recipientStatus === RECIPIENTS_CALL_STATUS.IN_PROCESS) {
      return 'processing';
    } else if (
      recipientStatus === RECIPIENTS_CALL_STATUS.FAILED ||
      recipientStatus === RECIPIENTS_CALL_STATUS.UN_SUCCESS
    ) {
      return 'failed';
    }
    return 'followup';
  }

  // Helper method to get readable status from disconnection reason
  private getStatusFromDisconnectionReason(reason: string): string {
    const reasonMap: any = {
      dial_no_answer: 'Not Answered',
      dial_busy: 'Line Busy',
      dial_failed: 'Call Failed',
      completed: 'Completed',
      hangup: 'Disconnected'
    };
    return reasonMap[reason] || reason || 'Pending';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.refreshInterval$.next();
    this.refreshInterval$.complete();
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
  }

  customSearch(event: any) {
    if (event) {
      this.recordsFilter.searchStr = event;
    } else {
      delete this.recordsFilter.searchStr;
    }
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 15;
    this.currentPage = 1;
    this.getRecordsList();
  }

  onBatchChange(event: any) {
    this.recordsFilter.batchIds = event?.batchIds;
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 15;
    this.currentPage = 1;
    this.getRecordsList();
  }

  removeItem(itemId: string, event: Event): void {
    event.stopPropagation();
    this.batchIds = this.batchIds.filter((id: string) => id !== itemId);
    this.onBatchSelect(this.batchIds);
  }

  currentLeadStatus(event: any) {
    this.recordsFilter.callLeadStatus = event?.leadStatus;
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 15;
    this.currentPage = 1;
    this.getRecordsList();
  }

  onBatchSelect(selectedItems: any) {
    this.onBatchChange({ batchIds: selectedItems });
  }

  selectLeadStatus(record: any) {
    this.currentLeadStatus({ leadStatus: record });
  }

  getStatusConfig(status: number) {
    return this._callStatusService.getCallStatus(status, this.callStatus);
  }

  formatDuration(duration: any) {
    if (!duration || duration === 0) return '0:00';
    return this._timeFormatService.setTime(duration);
  }

  goBack() {
    this._router.navigate([`/batch-call/${this.currentBatchCallPage}`], {
      queryParams: { userId: this.userId },
      queryParamsHandling: 'merge'
    });
  }

  retryPendingCall() {
    this.batchCallModalRef = this._modalService.open(this.confirmationModal, {
      centered: true,
      size: 'md',
      backdrop: 'static',
      windowClass: 'custom-lead-modal'
    });
  }

  completePendingCall() {
    this.batchCallModalRef = this._modalService.open(this.confirmationMarkBatchCompleteModal, {
      centered: true,
      size: 'md',
      backdrop: 'static',
      windowClass: 'custom-lead-modal'
    });
  }

  processPendingCall() {
    const payload = { id: this.batchIds };
    this.showLoader();
    this._batchCallService.pendingProcessBatchCall(payload).subscribe(
      async (response: any) => {
        if (this.batchCallModalRef) {
          this.batchCallModalRef.close();
          this.batchCallModalRef = null;
        }
        this.goBack();
        this.hideLoader();
        this.showSuccessToast('Pending call processing has been initiated successfully.');
      },
      (err) => {
        if (this.batchCallModalRef) {
          this.batchCallModalRef.close();
          this.batchCallModalRef = null;
        }
        this.showErrorToast(
          `Error in processing pending calls: ${err.error?.message || err.message}`
        );
        this.hideLoader();
      }
    );
  }

  completedPendingCall() {
    const payload = { id: this.batchIds };
    this.showLoader();
    this._batchCallService.markbatchCompleted(payload).subscribe(
      async (response: any) => {
        if (this.batchCallModalRef) {
          this.batchCallModalRef.close();
          this.batchCallModalRef = null;
        }
        this.goBack();
        this.hideLoader();
        this.showSuccessToast('Batch has been marked as completed successfully.');
      },
      (err) => {
        if (this.batchCallModalRef) {
          this.batchCallModalRef.close();
          this.batchCallModalRef = null;
        }
        this.showErrorToast(
          `Error in marking batch complete: ${err.error?.message || err.message}`
        );
        this.hideLoader();
      }
    );
  }

  retryButtonCondition(record: any, responseLogs: any = null) {
    if (!record || record.length === 0) {
      this.isVisibleRetryButton = false;
      this.completeBatchMarked = false;
      return;
    }

    const hasRecipientStatus1 = record.some((r: any) => r.recipientStatus === 1);
    const hasBatchStatus4Or9 = record.some((r: any) => r.batchStatus === 4 || r.batchStatus === 9);

    if (!hasRecipientStatus1 || !hasBatchStatus4Or9) {
      this.isVisibleRetryButton = false;
      this.completeBatchMarked = false;
      return;
    }

    if (!responseLogs || !responseLogs.attemptedAt) {
      this.isVisibleRetryButton = false;
      this.completeBatchMarked = false;
      return;
    }

    const attemptedAt = new Date(responseLogs.attemptedAt);
    const recipientIdsToUpdate = responseLogs.recipientIdsToUpdate || 0;
    const minutesToAdd = recipientIdsToUpdate > 10 ? (recipientIdsToUpdate / 10) * 5 : 5;
    const thresholdTime = new Date(attemptedAt.getTime() + minutesToAdd * 60000);
    const currentTime = new Date();

    if (thresholdTime > currentTime) {
      this.isVisibleRetryButton = false;
      this.completeBatchMarked = false;
    } else {
      if (responseLogs.action == 'PROCESS_ATTEMPT') {
        this.completeBatchMarked = true;
      }
      this.isVisibleRetryButton = true;
    }
  }

  // ============================================================================
  // FIXED: STATISTICS - Using recipientStatus with correct constants
  // ============================================================================

  getCompletedCount(): number {
    if (this.analysisData && this.analysisData.complete !== undefined) {
      return this.analysisData.complete;
    }
    if (!this.recordsList) return 0;
    return this.recordsList.filter((r: any) => r.recipientStatus === RECIPIENTS_CALL_STATUS.SUCCESS)
      .length;
  }

  getProcessingCount(): number {
    if (this.analysisData && this.analysisData.processing !== undefined) {
      return this.analysisData.processing;
    }
    if (!this.recordsList) return 0;
    return this.recordsList.filter(
      (r: any) => r.recipientStatus === RECIPIENTS_CALL_STATUS.IN_PROCESS
    ).length;
  }

  getQueuedCount(): number {
    if (this.analysisData && this.analysisData.queued !== undefined) {
      return this.analysisData.queued;
    }
    if (!this.recordsList) return 0;
    return this.recordsList.filter((r: any) => r.recipientStatus === RECIPIENTS_CALL_STATUS.PENDING)
      .length;
  }

  getSkippedCount(): number {
    if (this.analysisData && this.analysisData.skip !== undefined) {
      return this.analysisData.skip;
    }
    if (!this.recordsList) return 0;
    return this.recordsList.filter((r: any) => r.recipientStatus === RECIPIENTS_CALL_STATUS.SKIP)
      .length;
  }

  getFailedCount(): number {
    if (this.analysisData && this.analysisData.failed !== undefined) {
      return this.analysisData.failed;
    }
    if (!this.recordsList) return 0;
    return this.recordsList.filter(
      (r: any) =>
        r.recipientStatus === RECIPIENTS_CALL_STATUS.FAILED ||
        r.recipientStatus === RECIPIENTS_CALL_STATUS.UN_SUCCESS
    ).length;
  }

  getMeetingsCount(): number {
    if (this.analysisData && this.analysisData.meeting !== undefined) {
      return this.analysisData.meeting;
    }
    if (!this.recordsList) return 0;
    return this.recordsList.filter(
      (r: any) => r.callLeadStatus && r.callLeadStatus.toLowerCase().includes('meeting')
    ).length;
  }

  getFollowUpsCount(): number {
    if (this.analysisData && this.analysisData.followUps !== undefined) {
      return this.analysisData.followUps;
    }
    if (!this.recordsList) return 0;
    return this.recordsList.filter(
      (r: any) => r.callLeadStatus && r.callLeadStatus.toLowerCase().includes('follow')
    ).length;
  }

  // ============================================================================
  // FIXED: Status helpers using recipientStatus
  // ============================================================================

  isProcessing(record: any): boolean {
    return record.recipientStatus === RECIPIENTS_CALL_STATUS.IN_PROCESS;
  }

  isSkipped(record: any): boolean {
    return record.recipientStatus === RECIPIENTS_CALL_STATUS.SKIP;
  }

  isCompleted(record: any): boolean {
    return record.recipientStatus === RECIPIENTS_CALL_STATUS.SUCCESS;
  }

  isQueued(record: any): boolean {
    return record.recipientStatus === RECIPIENTS_CALL_STATUS.PENDING;
  }

  isFailed(record: any): boolean {
    return (
      record.recipientStatus === RECIPIENTS_CALL_STATUS.FAILED ||
      record.recipientStatus === RECIPIENTS_CALL_STATUS.UN_SUCCESS
    );
  }

  // ============================================================================
  // FIXED: Status label and badge using recipientStatus and constants
  // ============================================================================

  getStatusLabel(record: any): string {
    // Check for skipped status first
    if (this.isSkipped(record)) {
      return 'Skipped';
    }

    // Use switch statement with constants for clarity
    switch (record.recipientStatus) {
      case RECIPIENTS_CALL_STATUS.IN_PROCESS:
        return 'Calling...';
      case RECIPIENTS_CALL_STATUS.SUCCESS:
        return 'Completed';
      case RECIPIENTS_CALL_STATUS.PENDING:
        return 'Queued';
      case RECIPIENTS_CALL_STATUS.UN_SUCCESS:
        return 'Unsuccessful';
      case RECIPIENTS_CALL_STATUS.FAILED:
        return 'Failed';
      case RECIPIENTS_CALL_STATUS.DEAD:
        return 'Dead';
      default:
        return 'Pending';
    }
  }

  getStatusBadgeClass(record: any): string {
    // Check for skipped status first
    if (this.isSkipped(record)) {
      return 'status-badge status-badge-skipped';
    }

    switch (record.recipientStatus) {
      case RECIPIENTS_CALL_STATUS.IN_PROCESS:
        return 'status-badge status-badge-calling';
      case RECIPIENTS_CALL_STATUS.SUCCESS:
        return 'status-badge status-badge-completed';
      case RECIPIENTS_CALL_STATUS.PENDING:
        return 'status-badge status-badge-queued';
      case RECIPIENTS_CALL_STATUS.UN_SUCCESS:
      case RECIPIENTS_CALL_STATUS.FAILED:
        return 'status-badge status-badge-failed';
      case RECIPIENTS_CALL_STATUS.DEAD:
        return 'status-badge status-badge-dead';
      default:
        return 'status-badge';
    }
  }

  getSkipReason(record: any): string {
    // Return error message for BOTH skipped and failed records
    if ((this.isSkipped(record) || this.isFailed(record)) && record.errorMessage) {
      return this.sanitizeErrorMessage(record.errorMessage);
    }
    return '';
  }

  private sanitizeErrorMessage(errorMessage: string): string {
    // Handle Twilio authorization errors
    if (errorMessage.includes('Account not authorized to call')) {
      const phoneMatch = errorMessage.match(/\+\d+/);
      const phoneNumber = phoneMatch ? phoneMatch[0] : 'this number';
      return `Unable to place call to ${phoneNumber}. Please check international calling permissions.`;
    }

    // Handle other Twilio-specific errors
    if (errorMessage.toLowerCase().includes('twilio')) {
      // Remove Twilio branding and console links
      let cleaned = errorMessage
        .replace(/Couldn't Create Twilio Call\.\s*/i, '')
        .replace(/Twilio Error:\s*/i, '')
        .replace(/https:\/\/www\.twilio\.com[^\s]*/g, '')
        .replace(/Perhaps you need to[^.]*\./g, '')
        .trim();

      // If the message is now too generic or empty, provide a fallback
      if (!cleaned || cleaned.length < 10) {
        return 'Unable to complete the call. Please contact support for assistance.';
      }

      return cleaned;
    }

    // Return original message if no Twilio-specific content
    return errorMessage;
  }

  // Classification helpers
  getClassificationClass(status: string): string {
    if (!status) return 'classification-badge';
    const normalized = status.toLowerCase();
    if (normalized.includes('meeting') || normalized.includes('interested'))
      return 'classification-badge final';
    if (normalized.includes('follow')) return 'classification-badge followup';
    if (normalized.includes('unclassified')) return 'classification-badge neutral';
    return 'classification-badge';
  }

  getClassificationIcon(status: string): string {
    if (!status) return '';
    const normalized = status.toLowerCase();
    if (normalized.includes('meeting')) return '📅';
    if (normalized.includes('interested')) return '👍';
    if (normalized.includes("don't")) return '🚫';
    if (normalized.includes('follow')) return '🔄';
    if (normalized.includes('unclassified')) return '📋';
    return '📋';
  }

  // Call time helper
  getCallTime(record: any): string {
    if (this.isProcessing(record)) return 'Just now';
    if (this.isSkipped(record)) return '—';
    if (!record.callCreatedAt) return '—';
    return new Date(record.callCreatedAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // Attempt helpers
  getAttemptText(attempt: number): string {
    if (attempt === 1) return '1st attempt';
    if (attempt === 2) return '2nd attempt';
    if (attempt === 3) return '3rd attempt';
    return `${attempt}th attempt`;
  }

  getAttemptLabel(attempt: number): string {
    if (attempt === 1) return 'First Attempt';
    if (attempt === 2) return 'Second Attempt';
    if (attempt === 3) return 'Third Attempt';
    return `${attempt}th Attempt`;
  }

  // Expandable rows
  toggleExpand(index: number) {
    // Remove focus class from previously focused row
    if (this.currentFocusedRow !== null) {
      const previousRow = document.querySelector(`.expanded-content-${this.currentFocusedRow}`);
      if (previousRow) {
        previousRow.classList.remove('focused');
      }
    }

    // Close all other expanded rows
    Object.keys(this.expandedRows).forEach((key) => {
      const keyIndex = parseInt(key, 10);
      if (keyIndex !== index) {
        this.expandedRows[keyIndex] = false;
      }
    });

    // Toggle current row
    const wasExpanded = this.expandedRows[index];
    this.expandedRows[index] = !wasExpanded;

    // If expanding, scroll to the expanded content
    if (this.expandedRows[index]) {
      this.currentFocusedRow = index;

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
            if (this.currentFocusedRow === index) {
              this.currentFocusedRow = null;
            }
          }, 1000);
        }
      }, 100);
    } else {
      this.currentFocusedRow = null;
    }
  }

  // Filter
  filterStatus(status: string) {
    this.currentFilter = status;

    // Reset filter
    delete this.recordsFilter.statusFilter;

    // Apply filter based on selection - send string to backend
    if (status !== 'all') {
      this.recordsFilter.statusFilter = status;
    }

    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 15;
    this.currentPage = 1;
    this.getRecordsList();
  }

  // Date/time formatting
  formatDateTime(date: string, time: string): string {
    const d = new Date(`${date}T${time}`);
    return d.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  calculateRunningTime(startTime: Date, batchStatus: number, callCreatedAt?: string): string {
    let diff: number;

    // If batchStatus is 4 or 9, calculate difference between now and startTime (running)
    if (batchStatus === 4 || batchStatus === 9) {
      const now = new Date();
      diff = now.getTime() - startTime.getTime();
    }
    // If batchStatus is 5 (completed), calculate difference between startTime and callCreatedAt
    else if (batchStatus === 5 && callCreatedAt) {
      const endTime = new Date(callCreatedAt);
      diff = endTime.getTime() - startTime.getTime();
    }
    // Default: use current time
    else {
      const now = new Date();
      diff = now.getTime() - startTime.getTime();
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const parts: string[] = [];

    if (days > 0) {
      parts.push(`${days} day${days > 1 ? 's' : ''}`);
    }
    if (hours > 0) {
      parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    }
    if (minutes > 0 || parts.length === 0) {
      parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    }

    return parts.join(' ');
  }
}
