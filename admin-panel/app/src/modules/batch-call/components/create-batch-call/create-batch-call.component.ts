import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import { AppComponent } from 'app/app.component';
import { FluentAdminAppComponent } from 'app/src/core/shared-component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CustomValidators } from 'app/src/core/lib';
import { BatchCallService } from 'app/src/shared/services/api/batch-call-services';
import { AgentService } from 'app/src/shared/services/api/agent.services';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TimeFormatService } from 'app/src/shared/services/time-format.service';
import { Subject } from 'rxjs';
import * as XLSX from 'xlsx';


import { PhoneNumberService } from 'app/src/shared/services/api/phone-number.service';
import { AuthService } from 'app/src/shared/services/auth/auth-service';

@Component({
  selector: 'app-create-batch-call',
  templateUrl: './create-batch-call.component.html',
  styleUrl: './create-batch-call.component.scss',
  encapsulation: ViewEncapsulation.None // Added to match design system approach
})
export class CreateBatchCallComponent extends FluentAdminAppComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  @Output() batchCallCreateEvent = new EventEmitter<{}>();
  @ViewChild('batchCreateResponseModel') batchModal: any;

  @Input() agentId?: string;

  private readonly FOLLOWUP_TIME_CONFIG = {
    minTimeBetweenFollowupsInSeconds: 2 * 60 // Default: 2 minutes = 120 seconds
  };

  currentDateTime: any;
  submitted = false;
  uploadedFile = false;
  recordForm!: FormGroup;
  selectedCsvFile: any;
  isDragOver = false;
  agentListing: any;
  agentCount: any;
  hasOutboundPhone = false;
  followUpsList: Array<{ date: string; time: string; phoneNumberId?: string | null }> = [];
  @Input() companyId?: string | null;

  csvData: any[] = [];
  csvHeaders: string[] = [];
  showCsvTable = false;
  csvError: string = '';
  totalRowsCount = 0;
  get bmbyEnabled(): boolean {
    return this._authService.getCurrentUser()?.user?.bmbyConfig || false;
  }

  get expectedHeaders(): string[] {
    if (this.bmbyEnabled) {
      return [
        'client_id',
        'phone_number',
        'salutation',
        'first_name',
        'last_name',
        'gender',
        'email',
        'country'
      ];
    } else {
      return [
        'salutation',
        'phone_number',
        'gender',
        'first_name',
        'last_name',
        'email',
        'client_id',
        'country'
      ];
    }
  }
  contactSheetHeaders = ['first_name', 'last_name', 'email']; // Headers for contact list mode
  lastBatchResponse: any;
  agentsLoaded = false;
  noAgentsAvailable = false;

  phoneNumberListing: any[] = [];

  constructor(
    private appComponent: AppComponent,
    private fb: FormBuilder,
    private _batchCallService: BatchCallService,
    private _agentService: AgentService,
    private _phoneNumberService: PhoneNumberService,
    private _modalService: NgbModal,
    private _timeFormatService: TimeFormatService,
    private _authService: AuthService
  ) {
    super(appComponent);
    this.currentDateTime = {
      date: new Date(Date.now() + 11 * 60 * 1000),
      time: new Date().toLocaleTimeString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    this.getAgentListing();
    this.loadFilterListings();
    this.setValueInform();
  }

  loadFilterListings() {
    // Load Phone Numbers
    this._phoneNumberService.filterListing().subscribe(
      (response: any) => {
        this.phoneNumberListing = response?.data || [];
        console.log('Phone Number Filter Listing Response:', response);
      },
      (err) => {
        console.error('Error fetching phone number filter list:', err);
      }
    );
  }

  getAgentListing() {
    this.showLoader();
    this.agentsLoaded = false;
    this.noAgentsAvailable = false;

    const params: any = {};

    if (this.companyId) {
      params.companyId = this.companyId;
    }

    if (this.agentId) {
      params.userId = this.agentId;
    }

    this._agentService.filterListing(params).subscribe(
      async (response: any) => {
        this.agentsLoaded = true;
        this.agentListing = response?.data || [];
        this.agentCount = response?.totalCount || 0;

        if (this.agentCount === 0) {
          this.noAgentsAvailable = true;

          let errorMessage = 'No agents available for batch calling.';

          if (response?.requiresCompanyFilter && response?.isSuperAdmin) {
            errorMessage =
              'No agents are mapped to your account. Please map agents for your account and then create batch call.';
          } else if (response) {
            errorMessage =
              'No agents are mapped to your account. Please contact your administrator to map agents and then create batch call.';
          } else if (response?.message) {
            errorMessage = response.message;
          }

          this.showErrorToast(errorMessage);
          this.hideLoader();
          return;
        }

        // Find primary agent and set as default
        const primaryAgent = this.agentListing.find((agent: any) => agent.isPrimary);
        if (primaryAgent) {
          this.recordForm.get('selectedAgent')?.setValue(primaryAgent);
          this.recordForm.get('agentId')?.setValue(primaryAgent.agentId);
        }

        this.setValueInform();

        // Re-apply primary agent if form was reset in setValueInform (logic safety)
        if (primaryAgent) {
          setTimeout(() => {
            this.recordForm.get('selectedAgent')?.setValue(primaryAgent);
            this.recordForm.get('agentId')?.setValue(primaryAgent.agentId);
          });
        }

        this.hideLoader();
      },
      (err) => {
        this.agentsLoaded = true;
        this.noAgentsAvailable = true;
        const errorMessage = err.error?.message || err.message || 'Failed to fetch agents';
        this.showErrorToast(`Error in record fetching: ${errorMessage}`);
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
      file: [this.selectedCsvFile || null, Validators.required],
      name: ['', Validators.required],
      selectedAgent: [null, [outboundNumberValidator]],
      agentId: ['', CustomValidators.requiredValidator],
      status: [null, CustomValidators.requiredValidator],
      schedule: [true], // Set to true by default since scheduling is always required
      timezone: [this.currentDateTime?.timezone || null],
      date: [null],
      time: [null],
      followUpsDetails: [[]],
      isContactSheet: [false], // Add isContactSheet field
      phoneNumberId: [null, CustomValidators.requiredValidator]
    });

    if (this.agentCount === 1 && this.agentListing && this.agentListing.length === 1) {
      const singleAgent = this.agentListing[0];
      this.recordForm.get('selectedAgent')?.setValue(singleAgent);
      this.recordForm.get('agentId')?.setValue(singleAgent.agentId);
    }
  }

  onAgentSelected(selectedAgent: any) {
    if (selectedAgent && selectedAgent.agentId) {
      this.recordForm.patchValue({
        agentId: selectedAgent.agentId
      });
    } else {
      this.recordForm.patchValue({
        agentId: ''
      });
    }
  }


  onPhoneNumberSelected(selectedPhone: any) {
    if (selectedPhone && selectedPhone.phoneNumberId) {
      this.recordForm.controls['phoneNumberId'].setValue(selectedPhone.phoneNumberId);
    } else {
      this.recordForm.controls['phoneNumberId'].setValue(null);
    }
  }

  selectTab(event: any) {
    this.recordForm.controls['schedule']?.setValue(event);
    if (!event) {
      // Only clear if explicitly disabling schedule
      this.recordForm.controls['date']?.setValue(null);
      this.recordForm.controls['time']?.setValue(null);
    }
  }

  toggleImportMode() {
    const currentValue = this.recordForm.get('isContactSheet')?.value || false;
    this.recordForm.patchValue({ isContactSheet: !currentValue });
    // Clear uploaded file when toggling mode
    if (this.uploadedFile) {
      this.deleteFile();
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      if (!this.isValidFileType(file)) {
        this.showErrorToast('Please select a XLS or XLSX file');
        return;
      }

      if (!this.validateFileSize(file)) {
        return;
      }

      this.selectedCsvFile = file;
      this.uploadedFile = true;
      this.recordForm.controls['file'].setValue(file);

      this.csvHeaders = [];
      this.csvData = [];
      this.showCsvTable = false;
      this.csvError = '';
      this.totalRowsCount = 0;

      this.parseExcelFileForPreview(file);
      input.value = '';
    }
  }

  parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  deleteFile() {
    this.uploadedFile = false;
    this.selectedCsvFile = null;
    this.recordForm.controls['file'].setValue(null);
    this.csvData = [];
    this.csvHeaders = [];
    this.showCsvTable = false;
    this.csvError = '';
    this.totalRowsCount = 0;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const originalFile = event.dataTransfer?.files?.[0];

    if (originalFile && this.isValidFileType(originalFile)) {
      if (!this.validateFileSize(originalFile)) {
        return;
      }

      this.selectedCsvFile = originalFile;
      this.uploadedFile = true;
      this.recordForm.controls['file'].setValue(originalFile);
      this.parseExcelFileForPreview(originalFile);
    } else if (originalFile) {
      this.showErrorToast('Please select a XLS or XLSX file');
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    this.isDragOver = false;
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
      time: '',
      phoneNumberId: null
    };
    this.followUpsList.push(newFollowUp);
    this.recordForm.controls['followUpsDetails'].setValue([...this.followUpsList]);
  }

  deleteFollowUp(index: number) {
    this.followUpsList.splice(index, 1);
    this.recordForm.controls['followUpsDetails'].setValue([...this.followUpsList]);
  }

  updateFollowUpList() {
    this.recordForm.controls['followUpsDetails'].setValue([...this.followUpsList]);
  }

  getFileName(): string {
    return this.selectedCsvFile?.name || '';
  }

  getFileSize(): string {
    if (!this.selectedCsvFile) return '';

    const bytes = this.selectedCsvFile.size;
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  getTotalRowsCount(): number {
    return this.totalRowsCount;
  }

  getColumnValue(row: any, columnName: string, rowIndex: number): string {
    return row[columnName] || '';
  }

  validateFileSize(file: File, maxSizeMB: any = 50): boolean {
    const maxFileSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxFileSize) {
      this.showErrorToast(`File size must be less than ${maxSizeMB}MB`);
      return false;
    }
    return true;
  }

  private isValidFileType(file: File): boolean {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    const allowedExtensions = ['.xls', '.xlsx'];
    const fileName = file.name.toLowerCase();

    return (
      allowedTypes.includes(file.type) || allowedExtensions.some((ext) => fileName.endsWith(ext))
    );
  }

  close() {
    this._modalService.dismissAll();
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

  createFormData(): FormData {
    const formData = new FormData();
    const formValue = this.recordForm.value;

    const hasContactId = this.csvHeaders.includes('contact_id');
    const hasClientId = this.csvHeaders.includes('client_id');

    // If bmbyConfig is false and we have contact_id, map it to client_id
    if (this.selectedCsvFile && hasContactId && !hasClientId && !this.bmbyEnabled) {
      try {
        // Map data: Rename contact_id to client_id in all rows
        const mappedData = this.csvData.map((row: any) => {
          const newRow: any = {};
          Object.keys(row).forEach((key) => {
            const cleanKey = key.trim().toLowerCase();
            if (cleanKey === 'contact_id') {
              newRow['client_id'] = row[key];
            } else {
              newRow[key] = row[key];
            }
          });
          return newRow;
        });

        // Create new worksheet
        const ws = XLSX.utils.json_to_sheet(mappedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

        // Write to buffer
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        // Append the new "cleaned" file
        formData.append('file', blob, this.selectedCsvFile.name);
        console.log('Frontend: Mapped contact_id to client_id for backend compatibility');
      } catch (error) {
        console.error('Error transforming file, sending original:', error);
        formData.append('file', this.selectedCsvFile, this.selectedCsvFile.name);
      }
    } else if (this.selectedCsvFile && this.selectedCsvFile instanceof File) {
      formData.append('file', this.selectedCsvFile, this.selectedCsvFile.name);
    } else {
      console.error('ERROR: No valid file to upload!');
    }

    formData.append('name', formValue.name || '');

    formData.append('agentId', formValue.agentId || '');
    formData.append('status', formValue.status || '');
    formData.append('schedule', formValue.schedule?.toString() || 'false');
    formData.append('timezone', formValue.timezone || '');
    formData.append('isContactSheet', formValue.isContactSheet?.toString() || 'false');
    formData.append('phoneNumberId', formValue.phoneNumberId || '');

    // Always include date and time if they're provided
    if (formValue.date) {
      let dateValue = formValue.date;
      if (dateValue instanceof Date) {
        dateValue = this._timeFormatService.formatDateToYYYYMMDD(dateValue);
      }
      formData.append('date', dateValue);
    }

    if (formValue.time) {
      formData.append('time', formValue.time);
    }

    if (
      this.hasOutboundPhone &&
      formValue.followUpsDetails &&
      formValue.followUpsDetails.length > 0
    ) {
      formData.append('followUpsDetails', JSON.stringify(formValue.followUpsDetails));
    }

    return formData;
  }

  toggleOutbound(): void {
    this.hasOutboundPhone = !this.hasOutboundPhone;
    if (this.hasOutboundPhone && this.followUpsList.length === 0) {
      this.addFollowUp();
    }
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

  save(status: any) {
    if (this.agentCount === 0) {
      this.showErrorToast(
        'No agents available for batch calling. Please map agents before creating a batch call.'
      );
      return;
    }

    this.recordForm.controls['status'].setValue(status);

    if (!this.recordForm.controls['file'].value) {
      this.showErrorToast('File is Required');
      return;
    }

    // Validate date and time are provided
    if (!this.recordForm.controls['date'].value) {
      this.showErrorToast('Date is required');
      return;
    }
    if (!this.recordForm.controls['time'].value) {
      this.showErrorToast('Time is required');
      return;
    }

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
      const formData = this.createFormData();

      this._batchCallService.create(formData).subscribe(
        async (response) => {
          this.submitted = false;
          this.batchCallCreateEvent.emit();
          this._modalService.dismissAll();
          this.hideLoader();
          this.openBatchModal(response);
        },
        (err) => {
          let errorMessage = '';

          if (err.error?.validationReport) {
            if (err.error.summary) {
              const { total, invalid } = err.error.summary;
              errorMessage = `All ${total} contacts failed validation. Invalid: ${invalid}. Please check the downloaded validation report for detailed error information.`;
            } else {
              errorMessage = `Validation failed. Please check the downloaded validation report for details.`;
            }

            this.showErrorToast(errorMessage);
          } else if (
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

            this.showErrorToast(errorMessage);
          } else if (err.details && Array.isArray(err.details) && err.details.length > 0) {
            const details = err.details;

            if (details.length <= 5) {
              errorMessage = `Error in record creation: ${details.join(', ')}`;
            } else {
              const firstFive = details.slice(0, 5);
              const fullMessage = err.message || '';
              errorMessage = `Error in record creation: ${firstFive.join(', ')}. ${fullMessage}`;
            }

            this.showErrorToast(errorMessage);
          } else {
            errorMessage = `Error in record creation: ${err.error?.message || err.message || 'Unknown error occurred'}`;
            this.showErrorToast(errorMessage);
          }
          this.hideLoader();
        }
      );
    } else {
      this.submitted = true;
    }
    this.submitted = true;
  }

  openSuggestionsModal(content: any) {
    this._modalService.open(content, { size: 'md', centered: true });
  }

  parseExcelFileForPreview(file: File): void {
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);

        const workbook = XLSX.read(data, {
          type: 'array',
          cellText: false,
          cellDates: true,
          raw: false,
          cellNF: true
        });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

        let phoneColumnIndex = -1;
        for (let col = range.s.c; col <= range.e.c; col++) {
          const headerCell = worksheet[XLSX.utils.encode_cell({ r: 0, c: col })];
          if (
            headerCell &&
            headerCell.v &&
            String(headerCell.v).toLowerCase().trim() === 'phone_number'
          ) {
            phoneColumnIndex = col;
            break;
          }
        }

        if (phoneColumnIndex !== -1) {
          for (let row = range.s.r + 1; row <= range.e.r; row++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: phoneColumnIndex });
            const cell = worksheet[cellAddress];
            if (cell && cell.v !== undefined) {
              cell.t = 's';
              cell.v = String(cell.w || cell.v);
              delete cell.w;
            }
          }
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          defval: ''
        }) as any[][];

        let csvContent = jsonData
          .map((row) =>
            row
              .map((cell) => {
                const cellStr = String(cell || '');
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                  return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
              })
              .join(',')
          )
          .join('\n');

        this.processPreviewContent(csvContent);
      } catch (error) {
        this.csvError = 'Error reading Excel file for preview';
        this.showCsvTable = false;
        console.error('Error reading Excel:', error);
      }
    };

    reader.onerror = () => {
      this.csvError = 'Error reading Excel file';
      this.showCsvTable = false;
    };

    reader.readAsArrayBuffer(file);
  }

  convertDelimiters(csvContent: string): string {
    const lines = csvContent.split('\n');

    if (lines.length === 0) return csvContent;

    const firstLine = lines[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;

    if (semicolonCount > commaCount) {
      return csvContent.replace(/;/g, ',');
    }

    return csvContent;
  }

  processPreviewContent(csvContent: string) {
    try {
      const lines = csvContent.split('\n').filter((line) => line.trim());

      if (lines.length === 0) {
        this.csvError = 'File is empty';
        this.showCsvTable = false;
        return;
      }

      this.csvHeaders = this.parseExcelLine(lines[0]).map((h) => h.trim().toLowerCase());

      // Use different headers based on mode from form
      const isContactSheet = this.recordForm.get('isContactSheet')?.value || false;
      const requiredHeaders = isContactSheet ? this.contactSheetHeaders : this.expectedHeaders;
      const missingHeaders = requiredHeaders.filter((expected) => {
        if (expected === 'client_id' || expected === 'contact_id') {
          return (
            !this.csvHeaders.includes('client_id') && !this.csvHeaders.includes('contact_id')
          );
        }
        return !this.csvHeaders.includes(expected);
      });

      if (missingHeaders.length > 0) {
        this.showErrorToast(`Invalid file, required header columns: ${missingHeaders.join(', ')}`);
        this.selectedCsvFile = null;
        this.uploadedFile = false;
        this.recordForm.controls['file'].setValue(null);
        this.csvError = `Missing required columns: ${missingHeaders.join(', ')}`;
        this.showCsvTable = false;
        return;
      }

      this.totalRowsCount = lines.length - 1;
      this.csvData = [];
      const dataLines = lines.slice(1);
      for (const line of dataLines) {
        if (line.trim()) {
          const rowData = this.parseExcelLine(line);

          const hasData = rowData.some((cell) => cell && cell.trim() !== '');

          if (hasData) {
            const rowObject: any = {};

            this.csvHeaders.forEach((header, index) => {
              let cellValue = rowData[index] || '';

              if (header === 'phone_number' && cellValue && !isContactSheet) {
                cellValue = this.formatPhoneNumber(cellValue);
              }

              // Map contact_id to client_id if BMBY is disabled or if backend needs it
              if (!this.bmbyEnabled && header === 'contact_id' && !this.csvHeaders.includes('client_id')) {
                rowObject['client_id'] = cellValue;
              }

              rowObject[header] = cellValue;
            });

            this.csvData.push(rowObject);
          }
        }
      }

      this.showCsvTable = this.csvHeaders.length > 0 && this.csvData.length > 0;
      this.csvError = '';
    } catch (error) {
      this.csvError = 'Error parsing file content';
      this.showCsvTable = false;
      console.error('Error parsing file:', error);
    }
  }

  parseExcelFile(file: File): void {
    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);

        const workbook = XLSX.read(data, {
          type: 'array',
          cellText: false,
          cellDates: true,
          raw: false,
          cellNF: true
        });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

        let phoneColumnIndex = -1;
        for (let col = range.s.c; col <= range.e.c; col++) {
          const headerCell = worksheet[XLSX.utils.encode_cell({ r: 0, c: col })];
          if (
            headerCell &&
            headerCell.v &&
            String(headerCell.v).toLowerCase().trim() === 'phone_number'
          ) {
            phoneColumnIndex = col;
            break;
          }
        }

        if (phoneColumnIndex !== -1) {
          for (let row = range.s.r + 1; row <= range.e.r; row++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: phoneColumnIndex });
            const cell = worksheet[cellAddress];
            if (cell && cell.v !== undefined) {
              cell.t = 's';
              cell.v = String(cell.w || cell.v);
              delete cell.w;
            }
          }
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          defval: ''
        }) as any[][];

        const csvContent = jsonData
          .map((row) =>
            row
              .map((cell) => {
                const cellStr = String(cell || '');
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                  return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
              })
              .join(',')
          )
          .join('\n');

        this.processExcelContent(csvContent);
      } catch (error) {
        this.csvError = 'Error reading Excel file';
        this.showCsvTable = false;
        console.error('Error reading Excel:', error);
      }
    };

    reader.onerror = () => {
      this.csvError = 'Error reading Excel file';
      this.showCsvTable = false;
    };

    reader.readAsArrayBuffer(file);
  }

  processExcelContent(csvContent: string) {
    try {
      const lines = csvContent.split('\n').filter((line) => line.trim());

      if (lines.length === 0) {
        this.csvError = 'File is empty';
        this.showCsvTable = false;
        return;
      }

      this.csvHeaders = this.parseExcelLine(lines[0]).map((h) => h.trim().toLowerCase());

      // Use different headers based on mode from form
      const isContactSheet = this.recordForm.get('isContactSheet')?.value || false;
      const requiredHeaders = isContactSheet ? this.contactSheetHeaders : this.expectedHeaders;
      const missingHeaders = requiredHeaders.filter((expected) => {
        if (expected === 'client_id' || expected === 'contact_id') {
          return (
            !this.csvHeaders.includes('client_id') && !this.csvHeaders.includes('contact_id')
          );
        }
        return !this.csvHeaders.includes(expected);
      });

      if (missingHeaders.length > 0) {
        this.showErrorToast(`Invalid file, required header columns: ${missingHeaders.join(', ')}`);
        this.selectedCsvFile = null;
        this.uploadedFile = false;
        this.recordForm.controls['file'].setValue(null);
        this.csvError = `Missing required columns: ${missingHeaders.join(', ')}`;
        this.showCsvTable = false;
        return;
      }

      this.totalRowsCount = lines.length - 1;

      this.csvData = [];
      const dataLines = lines.slice(1, Math.min(lines.length));

      for (const line of dataLines) {
        if (line.trim()) {
          const rowData = this.parseExcelLine(line);
          const rowObject: any = {};

          this.csvHeaders.forEach((header, index) => {
            let cellValue = rowData[index] || '';

            // Map contact_id to client_id if BMBY is disabled or if backend needs it
            if (!this.bmbyEnabled && header === 'contact_id' && !this.csvHeaders.includes('client_id')) {
              rowObject['client_id'] = cellValue;
            }

            rowObject[header] = cellValue;
          });

          this.csvData.push(rowObject);
        }
      }

      this.showCsvTable = this.csvHeaders.length > 0 && this.csvData.length > 0;
      this.csvError = '';
    } catch (error) {
      this.csvError = 'Error parsing file content';
      this.showCsvTable = false;
      console.error('Error parsing file:', error);
    }
  }

  parseExcelLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  private formatPhoneNumber(value: string): string {
    if (!value) return '';

    const cleaned = value.toString().trim();

    if (cleaned.includes('E') || cleaned.includes('e')) {
      console.warn('Phone number in scientific notation - precision may be lost:', cleaned);
      const num = Number(cleaned);
      if (!isNaN(num)) {
        return num.toLocaleString('fullwide', { useGrouping: false });
      }
    }

    return cleaned;
  }

  downloadExcelReport(
    base64Buffer: string,
    fileName: string,
    mimeType: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ): void {
    try {
      const byteCharacters = atob(base64Buffer);
      const byteNumbers = new Array(byteCharacters.length);

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;

      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading Excel report:', error);
    }
  }

  downloadValidationReport(response: any): void {
    if (response?.validationReport) {
      const { buffer, fileName, mimeType } = response.validationReport;
      this.downloadExcelReport(buffer, fileName, mimeType);
    }
  }

  openBatchModal(data: any) {
    this.lastBatchResponse = data;
    this._modalService.open(this.batchModal, { size: 'lg', backdrop: 'static', centered: true });
  }

  downloadSampleFile() {
    const isContactSheet = this.recordForm.get('isContactSheet')?.value || false;



    if (isContactSheet) {
      // ============================================================================
      // CONTACT LIST MODE - Simple sample with first_name, last_name, email
      // ============================================================================
      const sampleData = [
        ['first_name', 'last_name', 'email'],
        ['John', 'Doe', 'john.doe@example.com'],
        ['Jane', 'Smith', 'jane.smith@example.com'],
        ['Michael', 'Brown', 'michael.brown@example.com']
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');

      // Set column widths for better readability
      worksheet['!cols'] = [
        { wch: 15 }, // first_name
        { wch: 15 }, // last_name
        { wch: 30 } // email
      ];

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Download the file
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', 'contact_list_sample.xlsx');
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

    } else if (this.bmbyEnabled) {
      // ============================================================================
      // BATCH CALL MODE - Full sample with all fields (BMBY Enabled)
      // ============================================================================
      const sampleData = [
        [
          'client_id',
          'phone_number',
          'salutation',
          'first_name',
          'last_name',
          'gender',
          'email',
          'country'
        ],
        [
          '1001',
          '+491000000000',
          'Herr',
          'Hans',
          'Mueller',
          'Masculine',
          'hans.mueller@example.com',
          'Germany'
        ]
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Batch Calls');

      // Set column widths for better readability
      worksheet['!cols'] = [
        { wch: 12 }, // client_id
        { wch: 18 }, // phone_number
        { wch: 12 }, // salutation
        { wch: 15 }, // first_name
        { wch: 15 }, // last_name
        { wch: 10 }, // gender
        { wch: 30 }, // email
        { wch: 12 } // country
      ];

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Download the file
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', 'batch_call_sample.xlsx');
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

    } else {
      // ============================================================================
      // BATCH CALL MODE - Custom Excel sample with specified headers (BMBY Disabled)
      // ============================================================================
      const sampleData = [
        [
          'salutation',
          'phone_number',
          'gender',
          'first_name',
          'last_name',
          'email',
          'client_id',
          'country'
        ],
        [
          'Herr',
          '+491000000000',
          'Masculine',
          'Hans',
          'Mueller',
          'hans.mueller@example.com',
          '1001',
          'Germany'
        ]
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Batch Calls');

      // Set column widths for better readability
      worksheet['!cols'] = [
        { wch: 12 }, // salutation
        { wch: 18 }, // phone_number
        { wch: 10 }, // gender
        { wch: 15 }, // first_name
        { wch: 15 }, // last_name
        { wch: 30 }, // email
        { wch: 12 }, // client_id
        { wch: 12 } // country
      ];

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Download the file
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', 'batch_call_sample.xlsx');
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    }
  }
}
