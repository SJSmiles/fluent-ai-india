// ============================================
// create-batch-from-calls.component.ts
// ============================================
import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { AppComponent } from 'app/app.component';
import { FluentAdminAppComponent } from 'app/src/core/shared-component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CustomValidators } from 'app/src/core/lib';
import { BatchCallService } from 'app/src/shared/services/api/batch-call-services';
import { AgentService } from 'app/src/shared/services/api/agent.services';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TimeFormatService } from 'app/src/shared/services/time-format.service';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-create-batch-from-calls',
  templateUrl: './create-batch-from-calls.component.html',
  styleUrl: './create-batch-from-calls.component.scss'
})
export class CreateBatchFromCallsComponent extends FluentAdminAppComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  @Output() batchCallCreateEvent = new EventEmitter<{}>();
  @Input() selectedCallIds: string[] = []; // Input from parent component
  @Input() selectedCallsData: any[] = []; // Full call data for preview

  private readonly FOLLOWUP_TIME_CONFIG = {
    minTimeBetweenFollowupsInSeconds: 15 * 60 // 15 minutes
  };

  currentDateTime: any;
  submitted = false;
  recordForm!: FormGroup;
  agentListing: any;
  agentCount: any;
  hasOutboundPhone = false;
  followUpsList: Array<{ date: string; time: string }> = [];

  // Preview data
  showPreview = false;
  previewData: any[] = [];

  constructor(
    private appComponent: AppComponent,
    private fb: FormBuilder,
    private _batchCallService: BatchCallService,
    private _agentService: AgentService,
    private _modalService: NgbModal,
    private _timeFormatService: TimeFormatService
  ) {
    super(appComponent);
    this.currentDateTime = {
      date: new Date(Date.now() + 11 * 60 * 1000),
      time: new Date().toLocaleTimeString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    this.getAgentListing();
  }

  ngOnInit() {
    this.setValueInform();
    this.preparePreviewData();
  }

  getAgentListing() {
    this.showLoader();
    this._agentService.filterListing().subscribe(
      async (response: any) => {
        this.agentListing = response?.data;
        this.agentCount = response?.totalCount;
        this.setValueInform();
        this.hideLoader();
      },
      (err) => {
        this.showErrorToast(`Error in record fetching: ${err.error?.message || err.message}`);
        this.setValueInform();
        this.hideLoader();
      }
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setValueInform() {
    const outboundNumberValidator =
      this.agentCount > 0 ? CustomValidators.requiredValidator : Validators.required;

    this.recordForm = this.fb.group({
      name: ['', Validators.required],
      outboundNumber: [null, [outboundNumberValidator]],
      agentId: ['', CustomValidators.requiredValidator],
      status: [null, CustomValidators.requiredValidator],
      schedule: [false],
      timezone: [this.currentDateTime?.timezone || null],
      date: [null],
      time: [null],
      followUpsDetails: [[]]
    });

    if (this.agentCount > 0 && this.agentCount == 1) {
      this.recordForm.get('outboundNumber')?.setValue(this.agentListing?.[0]?.primaryPhone);
      this.recordForm.get('agentId')?.setValue(this.agentListing?.[0]?.agentId);
    }
  }

  preparePreviewData() {
    if (this.selectedCallsData && this.selectedCallsData.length > 0) {
      this.previewData = this.selectedCallsData.map((call) => ({
        clientId: call.bmbyId || '',
        phoneNumber: call.number || call.toNumber || '',
        firstName: call.firstName || '',
        lastName: call.lastName || '',
        gender: call.gender || 'other',
        email: call.email || '',
        country: call.country || 'India'
      }));
      this.showPreview = true;
    }
  }

  selectTab(event: any) {
    this.recordForm.controls['schedule']?.setValue(event);
    this.recordForm.controls['date']?.setValue(null);
    this.recordForm.controls['time']?.setValue(null);
  }

  onAgentSelected(selectedPhone: string) {
    const selectedAgent = this.agentListing.find(
      (agent: any) => agent.primaryPhone === selectedPhone
    );
    if (selectedAgent) {
      this.recordForm.get('agentId')?.setValue(selectedAgent.agentId);
    } else {
      this.recordForm.get('agentId')?.reset();
    }
  }

  onDateSelected(event: Date, followUpIndex?: number) {
    let selectedDate = new Date(event);
    const formattedDate = this._timeFormatService.formatDateToYYYYMMDD(selectedDate);
    const timeOnly = selectedDate.toTimeString().slice(0, 5);

    if (followUpIndex !== undefined) {
      if (this.followUpsList[followUpIndex]) {
        this.followUpsList[followUpIndex].date = formattedDate;
        this.followUpsList[followUpIndex].time = timeOnly;
        this.recordForm.controls['followUpsDetails'].setValue([...this.followUpsList]);
        this.followUpsList = [...this.followUpsList];
      }
    } else {
      this.recordForm.controls['date'].setValue(formattedDate);
      this.recordForm.controls['time'].setValue(timeOnly);
    }
  }

  addFollowUp() {
    if (this.followUpsList.length >= 10) {
      this.showErrorToast('Maximum 10 follow-ups are allowed');
      return;
    }
    const newFollowUp = {
      date: '',
      time: ''
    };
    this.followUpsList.push(newFollowUp);
    this.recordForm.controls['followUpsDetails'].setValue([...this.followUpsList]);
  }

  deleteFollowUp(index: number) {
    this.followUpsList.splice(index, 1);
    this.recordForm.controls['followUpsDetails'].setValue([...this.followUpsList]);
  }

  onToggleChange(event: Event): void {
    event.stopPropagation();
    const toggle = event.target as HTMLInputElement;
    this.hasOutboundPhone = toggle.checked;
    if (this.hasOutboundPhone && this.followUpsList.length === 0) {
      this.addFollowUp();
    }
  }

  private get minTimeDifferenceMs(): number {
    return this.FOLLOWUP_TIME_CONFIG.minTimeBetweenFollowupsInSeconds * 1000;
  }

  private get timeDifferenceDescription(): string {
    const seconds = this.FOLLOWUP_TIME_CONFIG.minTimeBetweenFollowupsInSeconds;
    if (seconds < 60) {
      return seconds === 1 ? '1 second' : `${seconds} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return minutes === 1 ? '1 minute' : `${minutes} minutes`;
    } else if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return hours === 1 ? '1 hour' : `${hours} hours`;
    } else {
      const days = Math.floor(seconds / 86400);
      return days === 1 ? '1 day' : `${days} days`;
    }
  }

  validateFollowUpGaps(): boolean {
    if (this.followUpsList.length > 0) {
      const firstFollowUp = this.followUpsList[0];
      const status = this.recordForm.get('schedule')?.value;

      if (!firstFollowUp.date || !firstFollowUp.time) {
        // Will be caught by empty field validation
      } else {
        let firstFollowUpTimeString = firstFollowUp.time;
        if (firstFollowUpTimeString.split(':').length === 2) {
          firstFollowUpTimeString += ':00';
        }

        const firstFollowUpDateTime = new Date(`${firstFollowUp.date}T${firstFollowUpTimeString}`);
        if (!isNaN(firstFollowUpDateTime.getTime())) {
          let compareDateTime: Date;
          let compareLabel: string;

          if (status) {
            const scheduledDate = this.recordForm.get('date')?.value;
            const scheduledTime = this.recordForm.get('time')?.value;

            if (scheduledDate && scheduledTime) {
              let scheduledTimeString = scheduledTime;
              if (scheduledTimeString.split(':').length === 2) {
                scheduledTimeString += ':00';
              }

              compareDateTime = new Date(`${scheduledDate}T${scheduledTimeString}`);
              compareLabel = 'scheduled batch call time';
              if (isNaN(compareDateTime.getTime())) {
                this.showErrorToast('Invalid scheduled date or time format');
                return false;
              }
            } else {
              this.showErrorToast('Scheduled date and time are required');
              return false;
            }
          } else {
            compareDateTime = new Date();
            compareLabel = 'current time';
          }

          const timeDiffMs = firstFollowUpDateTime.getTime() - compareDateTime.getTime();

          if (timeDiffMs < 0) {
            this.showErrorToast(`First follow-up cannot be scheduled before ${compareLabel}`);
            return false;
          }

          if (timeDiffMs < this.minTimeDifferenceMs) {
            this.showErrorToast(
              `First follow-up must be at least ${this.timeDifferenceDescription} after ${compareLabel}`
            );
            return false;
          }
        }
      }
    }

    // Check for empty fields
    for (let i = 0; i < this.followUpsList.length; i++) {
      const followUp = this.followUpsList[i];
      if (!followUp.date || followUp.date === '' || followUp.date.trim() === '') {
        this.showErrorToast(`Follow-up ${i + 1} is missing a date`);
        return false;
      }
      if (!followUp.time || followUp.time === '' || followUp.time.trim() === '') {
        this.showErrorToast(`Follow-up ${i + 1} is missing a time`);
        return false;
      }
    }

    // Check gaps between follow-ups
    if (this.followUpsList.length > 1) {
      for (let i = 0; i < this.followUpsList.length - 1; i++) {
        const current = this.followUpsList[i];
        const next = this.followUpsList[i + 1];

        let currentTimeString = current.time;
        let nextTimeString = next.time;

        const currentDateTime = new Date(`${current.date}T${currentTimeString}`);
        const nextDateTime = new Date(`${next.date}T${nextTimeString}`);
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

  onFollowUpDateSelected(event: Date, followUpIndex: number) {
    let selectedDate = new Date(event);
    const formattedDate = this._timeFormatService.formatDateToYYYYMMDD(selectedDate);
    const timeOnly = selectedDate.toTimeString().slice(0, 5);

    if (this.followUpsList[followUpIndex]) {
      this.followUpsList[followUpIndex].date = formattedDate;
      this.followUpsList[followUpIndex].time = timeOnly;
      this.recordForm.controls['followUpsDetails'].setValue([...this.followUpsList]);
    }
  }

  createRequestPayload(): any {
    const formValue = this.recordForm.value;

    const payload: any = {
      name: formValue.name || '',
      agentId: formValue.agentId || '',
      callIds: this.selectedCallIds,
      status: formValue.status || '',
      schedule: formValue.schedule || false,
      timezone: formValue.timezone || ''
    };

    const outboundNumber =
      this.agentCount > 0 ? formValue.outboundNumber || '' : '+' + (formValue.outboundNumber || '');
    payload.outboundNumber = outboundNumber;

    if (formValue.schedule && formValue.date) {
      let dateValue = formValue.date;
      if (dateValue instanceof Date) {
        dateValue = this._timeFormatService.formatDateToYYYYMMDD(dateValue);
      }
      payload.date = dateValue;
    }

    if (formValue.schedule && formValue.time) {
      payload.time = formValue.time;
    }

    if (
      this.hasOutboundPhone &&
      formValue.followUpsDetails &&
      formValue.followUpsDetails.length > 0
    ) {
      payload.followUpsDetails = formValue.followUpsDetails;
    }

    return payload;
  }

  close() {
    this._modalService.dismissAll();
  }

  save(status: any) {
    this.recordForm.controls['status'].setValue(status);

    // Validate call IDs
    if (!this.selectedCallIds || this.selectedCallIds.length === 0) {
      this.showErrorToast('No calls selected. Please select at least one call.');
      return;
    }

    // Validate schedule
    if (this.recordForm.controls['schedule'].value) {
      if (!this.recordForm.controls['date'].value) {
        this.showErrorToast('Date is required');
        return;
      }
      if (!this.recordForm.controls['time'].value) {
        this.showErrorToast('Time is required');
        return;
      }
    } else {
      this.recordForm.controls['date'].setValue(null);
      this.recordForm.controls['time'].setValue(null);
    }

    // Validate follow-ups if enabled
    if (this.hasOutboundPhone) {
      if (!this.followUpsList || this.followUpsList.length === 0) {
        this.showErrorToast('At least one follow-up is required when FollowUps is enabled');
        return;
      }

      if (!this.validateFollowUpGaps()) {
        return;
      }
    }

    if (this.recordForm.valid) {
      this.showLoader();
      const payload = this.createRequestPayload();

      // Call the new API endpoint
      this._batchCallService.createFromCalls(payload).subscribe(
        async (response) => {
          this.showSuccessToast('Batch call created successfully from selected calls');
          this.submitted = false;
          this.batchCallCreateEvent.emit();
          this._modalService.dismissAll();
          this.hideLoader();
        },
        (err) => {
          let errorMessage = '';

          if (
            err.error?.details &&
            Array.isArray(err.error.details) &&
            err.error.details.length > 0
          ) {
            const details = err.error.details;
            if (details.length <= 5) {
              errorMessage = `Error in record creation: ${details.join(', ')}`;
            } else {
              const firstFive = details.slice(0, 5);
              const fullMessage = err.error?.message || '';
              errorMessage = `Error in record creation: ${firstFive.join(', ')}. ${fullMessage}`;
            }
          } else {
            errorMessage = `Error in record creation: ${err.error?.message || err.message || 'Unknown error occurred'}`;
          }

          this.showErrorToast(errorMessage);
          this.hideLoader();
        }
      );
    } else {
      this.submitted = true;
    }
    this.submitted = true;
  }

  getColumnValue(row: any, columnName: string): string {
    return row[columnName] || '';
  }
}
