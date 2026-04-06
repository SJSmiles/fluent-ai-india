import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  OnChanges,
  SimpleChanges,
  Output,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import { AppComponent } from 'app/app.component';
import { FluentAdminAppComponent } from 'app/src/core/shared-component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CustomValidators } from 'app/src/core/lib';
import { BatchCallService } from 'app/src/shared/services/api/batch-call-services';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TimeFormatService } from 'app/src/shared/services/time-format.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface ErrorRecipient {
  _id: string;
  number: string;
  errorMessage: string;
  attemptLength: number;
  status: number;
  updatedAt: string;
  selected?: boolean;
}

interface BatchData {
  _id: string;
  name: string;
  agentId: string;
  totalRecipient: number;
  processedRecipient: number;
  errorRecipients: ErrorRecipient[];
  followups?: any[];
  agentName?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface SuccessCategory {
  name: string;
  count: number;
}

interface FailureCategory {
  name: string;
  count: number;
}

@Component({
  selector: 'app-retry-failed-calls',
  templateUrl: './retry-failed-calls.component.html',
  styleUrls: ['./retry-failed-calls.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class RetryFailedCallsComponent
  extends FluentAdminAppComponent
  implements OnInit, OnChanges, OnDestroy
{
  private destroy$ = new Subject<void>();
  @Output() retryCallEvent = new EventEmitter<{}>();
  @ViewChild('retryResponseModal') retryModal: any;
  @Input() batchId?: string;
  @Input() companyId?: string | null;
  @Input() batchDataInput?: any;

  retryForm!: FormGroup;
  submitted = false;
  currentDateTime: any;
  minDateTime: { date: string; time: string } = { date: '', time: '' };

  // Summary data
  totalNumbers = 0;
  successfullyProcessed = 0;
  availableForRetry = 0;
  batchName = '';
  batchCode = '';

  // Failure categories - will be calculated from error messages
  failureCategories: FailureCategory[] = [];

  // Success categories - static for now
  successCategories: SuccessCategory[] = [
    { name: 'Meeting Booked', count: 0 },
    { name: 'Interested', count: 0 },
    { name: 'Not Interested', count: 0 },
    { name: 'Human Review Needed', count: 0 },
    { name: 'Human Action Needed', count: 0 },
    { name: 'Not Interested for Now', count: 0 },
    { name: 'Changed Interest', count: 0 },
    { name: 'Invalid Leads', count: 0 }
  ];

  // Failed calls data - mapped from errorRecipients
  failedCalls: ErrorRecipient[] = [];
  originalBatchData: BatchData | null = null;

  showFailureSection = true;
  showSuccessSection = false;
  lastRetryResponse: any;

  constructor(
    private appComponent: AppComponent,
    private fb: FormBuilder,
    private _batchCallService: BatchCallService,
    private _modalService: NgbModal,
    private _timeFormatService: TimeFormatService
  ) {
    super(appComponent);
    this.currentDateTime = {
      date: new Date(Date.now() + 11 * 60 * 1000),
      time: new Date().toLocaleTimeString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    // Set minimum date/time (current + 10 minutes)
    this.updateMinDateTime();
  }

  ngOnInit(): void {
    this.initializeForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['batchDataInput'] && changes['batchDataInput'].currentValue) {
      const data = changes['batchDataInput'].currentValue;
      if (data) {
        // Handle both single object and array
        if (Array.isArray(data)) {
          this.processBatchData(data);
        } else {
          this.processBatchData([data]);
        }
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  updateMinDateTime(): void {
    const now = new Date();
    const futureTime = new Date(now.getTime() + 10 * 60 * 1000);

    this.minDateTime.date = this._timeFormatService.formatDateToYYYYMMDD(futureTime);
    this.minDateTime.time = futureTime.toTimeString().slice(0, 5);
  }

  initializeForm(): void {
    // Set initial date to today
    const now = new Date();
    const futureTime = new Date(now.getTime() + 10 * 60 * 1000);
    const initialDate = this._timeFormatService.formatDateToYYYYMMDD(futureTime);
    const initialTime = futureTime.toTimeString().slice(0, 5);

    this.retryForm = this.fb.group({
      schedule: [true], // Always schedule
      timezone: [this.currentDateTime?.timezone || null],
      date: [initialDate, CustomValidators.requiredValidator],
      time: [initialTime, CustomValidators.requiredValidator]
    });
  }

  processBatchData(data: BatchData[]): void {
    if (!data || data.length === 0) return;

    // Take the first batch data
    const batchData = data[0];
    this.originalBatchData = batchData;

    // Set basic info
    this.batchName = batchData.name || '';
    this.batchCode = batchData._id || '';
    this.batchId = batchData._id;

    // Calculate totals
    this.totalNumbers = batchData.totalRecipient || 0;
    this.availableForRetry = batchData.errorRecipients?.length || 0;
    this.successfullyProcessed = this.totalNumbers - this.availableForRetry;

    // Process error recipients (failed calls)
    if (batchData.errorRecipients && batchData.errorRecipients.length > 0) {
      this.failedCalls = batchData.errorRecipients.map((recipient) => ({
        ...recipient,
        selected: true // Select all by default
      }));

      // Categorize failures by error type
      this.categorizeFailures(batchData.errorRecipients);
    }
  }

  categorizeFailures(errorRecipients: ErrorRecipient[]): void {
    const categoryMap: { [key: string]: number } = {};

    errorRecipients.forEach((recipient) => {
      const errorMsg = recipient.errorMessage?.toLowerCase() || '';

      let category = 'Other Error';

      if (errorMsg.includes('timeout')) {
        category = 'Timeout Error';
      } else if (errorMsg.includes('twilio')) {
        category = 'Twilio Connection Error';
      } else if (errorMsg.includes('connection')) {
        category = 'Connection Error';
      } else if (errorMsg.includes('paused')) {
        category = 'Paused';
      } else if (errorMsg.includes('unauthorized') || errorMsg.includes('permissions')) {
        category = 'Authorization Error';
      } else if (errorMsg.includes('invalid')) {
        category = 'Invalid Number';
      }

      categoryMap[category] = (categoryMap[category] || 0) + 1;
    });

    this.failureCategories = Object.entries(categoryMap).map(([name, count]) => ({
      name,
      count
    }));
  }

  onDateSelected(event: any): void {
    const selectedDateValue = event.target.value;
    if (!selectedDateValue) return;

    const selectedDate = new Date(selectedDateValue + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If selected date is today, ensure time is at least current + 10 minutes
    if (selectedDate.getTime() === today.getTime()) {
      const currentTime = this.retryForm.get('time')?.value;
      if (currentTime) {
        const [hours, minutes] = currentTime.split(':').map(Number);
        const selectedDateTime = new Date();
        selectedDateTime.setHours(hours, minutes, 0, 0);

        const minTime = new Date(Date.now() + 10 * 60 * 1000);

        if (selectedDateTime < minTime) {
          // Set to minimum allowed time
          this.retryForm.patchValue({
            time: this.minDateTime.time
          });
          this.showErrorToast('Time must be at least 10 minutes from now');
        }
      }
    }

    this.retryForm.patchValue({
      date: selectedDateValue
    });
  }

  onTimeSelected(event: any): void {
    const selectedTime = event.target.value;
    const selectedDate = this.retryForm.get('date')?.value;

    if (!selectedTime || !selectedDate) return;

    const today = new Date();
    const todayStr = this._timeFormatService.formatDateToYYYYMMDD(today);

    // Only validate if selected date is today
    if (selectedDate === todayStr) {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const selectedDateTime = new Date();
      selectedDateTime.setHours(hours, minutes, 0, 0);

      const minTime = new Date(Date.now() + 10 * 60 * 1000);

      if (selectedDateTime < minTime) {
        // Reset to minimum allowed time
        this.retryForm.patchValue({
          time: this.minDateTime.time
        });
        this.showErrorToast('Time must be at least 10 minutes from now');
        return;
      }
    }

    this.retryForm.patchValue({
      time: selectedTime
    });
  }

  // Toggle all checkboxes
  toggleSelectAll(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const isChecked = checkbox.checked;
    this.failedCalls.forEach((call) => (call.selected = isChecked));
  }

  // Check if all are selected
  isAllSelected(): boolean {
    return this.failedCalls.length > 0 && this.failedCalls.every((call) => call.selected);
  }

  // Check if some are selected (for indeterminate state)
  isSomeSelected(): boolean {
    const selectedCount = this.failedCalls.filter((call) => call.selected).length;
    return selectedCount > 0 && selectedCount < this.failedCalls.length;
  }

  // Get count of selected calls
  getSelectedCount(): number {
    return this.failedCalls.filter((call) => call.selected).length;
  }

  // Deselect all
  deselectAll(): void {
    this.failedCalls.forEach((call) => (call.selected = false));
  }

  // Toggle failure section
  toggleFailureSection(): void {
    this.showFailureSection = !this.showFailureSection;
  }

  // Toggle success section
  toggleSuccessSection(): void {
    this.showSuccessSection = !this.showSuccessSection;
  }

  // Validate date and time before submission
  validateDateTime(): boolean {
    const date = this.retryForm.get('date')?.value;
    const time = this.retryForm.get('time')?.value;

    if (!date || !time) {
      return false;
    }

    const [hours, minutes] = time.split(':').map(Number);
    const selectedDateTime = new Date(date);
    selectedDateTime.setHours(hours, minutes, 0, 0);

    const minDateTime = new Date(Date.now() + 10 * 60 * 1000);

    if (selectedDateTime < minDateTime) {
      this.showErrorToast('Scheduled time must be at least 10 minutes from now');
      return false;
    }

    return true;
  }

  // Retry selected numbers
  retrySelectedNumbers(): void {
    if (this.getSelectedCount() === 0) {
      this.showErrorToast('Please select at least one number to retry');
      return;
    }

    // Validate date and time
    if (!this.retryForm.controls['date'].value) {
      this.showErrorToast('Date is required');
      return;
    }
    if (!this.retryForm.controls['time'].value) {
      this.showErrorToast('Time is required');
      return;
    }

    if (this.retryForm.invalid) {
      this.showErrorToast('Please fill all required fields');
      return;
    }

    // Validate that time is at least 10 minutes from now
    if (!this.validateDateTime()) {
      return;
    }

    const selectedRecipientIds = this.failedCalls
      .filter((call) => call.selected)
      .map((call) => call._id);

    this.showLoader();
    this.submitted = true;

    const retryPayload = {
      id: this.batchId,
      date: this.retryForm.value.date,
      time: this.retryForm.value.time,
      recipientsIds: selectedRecipientIds
    };

    console.log('Retry Payload:', retryPayload);

    this._batchCallService
      .pendingProcessBatchCall(retryPayload)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          this.submitted = false;
          this.retryCallEvent.emit(response);
          this.hideLoader();
          this.showSuccessToast('Retry batch call scheduled successfully');
          this._modalService.dismissAll();
        },
        (err) => {
          this.submitted = false;
          const errorMessage = err.error?.message || err.message || 'Failed to retry calls';
          this.showErrorToast(`Error: ${errorMessage}`);
          this.hideLoader();
        }
      );
  }

  // Cancel/Close modal
  cancel(): void {
    this._modalService.dismissAll();
  }

  close(): void {
    this._modalService.dismissAll();
  }

  // Get status badge class
  getStatusClass(recipient: ErrorRecipient): string {
    // Status 7 means failed
    const errorMsg = recipient.errorMessage?.toLowerCase() || '';

    if (errorMsg.includes('timeout')) return 'status-timeout';
    if (errorMsg.includes('twilio') || errorMsg.includes('connection')) return 'status-connection';
    if (errorMsg.includes('paused')) return 'status-paused';
    if (errorMsg.includes('unauthorized') || errorMsg.includes('permissions'))
      return 'status-paused';

    return 'status-default';
  }

  getSkipReason(record: any) {
    // Return error message for BOTH skipped and failed records
    if (record.errorMessage) {
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

  getStatusLabel(recipient: ErrorRecipient): string {
    const errorMsg = recipient.errorMessage?.toLowerCase() || '';

    if (errorMsg.includes('timeout')) return 'Timeout Error';
    if (errorMsg.includes('twilio')) return 'Twilio Connection Error';
    if (errorMsg.includes('connection')) return 'Connection Error';
    if (errorMsg.includes('paused')) return 'Paused';
    if (errorMsg.includes('unauthorized') || errorMsg.includes('permissions'))
      return 'Authorization Error';
    if (errorMsg.includes('invalid')) return 'Invalid Number';

    return 'Failed';
  }

  formatLastAttempt(updatedAt: string): string {
    if (!updatedAt) return '';

    const date = new Date(updatedAt);
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };

    return date.toLocaleString('en-US', options);
  }

  openRetryModal(data: any): void {
    this.lastRetryResponse = data;
    if (this.retryModal) {
      this._modalService.open(this.retryModal, {
        size: 'lg',
        backdrop: 'static',
        centered: true
      });
    }
  }
}
