import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NgbDropdown, NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { AppComponent } from 'app/app.component';
import { RecordsListComponent } from 'app/src/core/shared-component';
import { ContactService } from 'app/src/shared/services/api/contact.service';
import { AuthService } from 'app/src/shared/services/auth/auth-service';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, combineLatest, takeUntil } from 'rxjs';
import { CompanyService } from 'app/src/shared/services/api/company.service';
import { UserService } from 'app/src/shared/services';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent extends RecordsListComponent<any> implements OnDestroy {
  private destroy$ = new Subject<void>();
  @ViewChild('createContactModel') createContactModel!: TemplateRef<any>;
  @ViewChild('confirmDeleteModal') confirmDeleteModal!: TemplateRef<any>;
  @ViewChild('uploadResponseModal') uploadResponseModal!: TemplateRef<any>;
  @ViewChild('uploadContactsModal') uploadContactsModal!: TemplateRef<any>;
  @ViewChild('suggestionsModal') suggestionsModal!: TemplateRef<any>;
  contactModalRef: NgbModalRef | null = null;
  uploadModalRef: NgbModalRef | null = null;
  currentSort: any;
  selectedText: string = '';
  clearFilter: boolean = false;
  override currentPageSize: any = 15;

  override sortStates: any = {
    firstName: 'asc',
    lastName: 'asc',
    email: 'asc',
    bmbyId: 'asc'
  };
  currentUser: any;
  companyListing: any[] = [];
  companyId: string | null = null;
  companyListLoaded: boolean = false;

  userListing: any[] = [];
  selectedUserId: string | null = null;
  userListLoaded: boolean = false;

  selectedCompany: any = null;
  selectedContactData: any;
  lastUploadResponse: any = null;
  isUploading: boolean = false;
  selectedFile: File | null = null;
  isDragOver: boolean = false;
  uploadError: string = '';
  csvData: any[] = [];
  csvHeaders: string[] = [];
  showCsvTable: boolean = false;
  csvError: string = '';
  totalRowsCount: number = 0;
  expectedHeaders = [
    'phone_number',
    'first_name',
    'last_name',
    'email',
    'gender',
    'salutation',
    'client_id',
    'country'
  ];

  constructor(
    private appComponent: AppComponent,
    private _contactService: ContactService,
    private _modalService: NgbModal,
    private _userService: UserService,
    private authService: AuthService,
    private _companyService: CompanyService,
    private activatedRoute: ActivatedRoute
  ) {
    super(appComponent);
    this.recordsFilter.limit = 15;
    this.recordsFilter.sortBy = 'createdAt desc';
    this.currentSort = 'firstName';

    // ==================== CENTRALIZED INITIALIZATION ====================
    combineLatest([
      this.authService.currentUser$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([user]) => {
        this.currentUser = user;
        this.companyId = this.currentUser?.user?.companyId;
        this.selectedUserId = this.currentUser?.user?._id;
        this.recordsFilter.companyId = this.currentUser?.user?.companyId;
        this.recordsFilter.userId = this.currentUser?.user?._id;
      });

    if (this.currentUser?.user?.isSuperAdmin && this.currentUser?.user?.isAdmin) {
      this.getCompanyListing();
    }
    if (this.currentUser?.user?.isAdmin) {
      this.getUserListing();
    }
    if (!this.currentUser?.user?.isAdmin) {
      this.getRecordsList();
    }

  }

  getRecordsList(): void {
    this.showLoader();
    this._contactService
      .listing(this.recordsFilter)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          this.recordsList = response?.data?.contacts || [];
          this.totalCount = response?.data?.total || 0;
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

  getCompanyListing() {
    this.showLoader();
    this._companyService.getCompanyFilterList().subscribe(
      (response: any) => {
        console.log(response);
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

  getUserListing() {
    if (!this.currentUser?.user?.isAdmin) {
      return;
    }
    this.showLoader();
    const payload = {
      companyId: this.recordsFilter?.companyId
    };
    this._userService.filterListing(payload).subscribe(
      (response: any) => {
        this.userListing = response?.data?.map((user: any) => {
          const name = `${user.firstName} ${user.lastName || ''}`.trim();
          const truncatedName = name.length > 15 ? name.slice(0, 15) + '…' : name;
          return { ...user, fullName: truncatedName };
        });
        if (this.companyId === this.currentUser.user.companyId) {
          this.selectedUserId = this.currentUser.user?._id;
        } else {
          this.selectedUserId = this.userListing[0]?._id;
        }
        this.recordsFilter.userId = this.selectedUserId;
        this.getRecordsList();
        this.hideLoader();
      },
      (err) => {
        this.showErrorToast(`Error fetching users: ${err.error?.message || err.message}`);
        this.hideLoader();
      }
    );
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
    this.getUserListing();
  }


  selectUser(event: any) {
    this.selectedUserId = event?.value || event?._id || event?.id || event;

    this.recordsFilter.userId = this.selectedUserId;


    if (this.selectedUserId) {
      this.recordsFilter.userId = this.selectedUserId;
    } else {
      delete this.recordsFilter.userId;
    }

    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 15;
    this.currentPage = 1;

    this.getRecordsList();
  }

  // ==================== SORTING ====================
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

  // ==================== PAGINATION ====================
  override pageChanged(pageNumber: number): void {
    this.currentPage = pageNumber;
    this.pageIndex = pageNumber - 1;
    this.recordsFilter.skip = this.pageIndex * this.currentPageSize;
    this.getRecordsList();
  }

  // ==================== SEARCH ====================
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
  }

  // ==================== HELPER METHODS ====================
  updateSelectedCompany() {
    if (this.companyId && this.companyListing) {
      this.selectedCompany = this.companyListing.find(
        (company: any) => company._id === this.companyId
      );
    } else {
      this.selectedCompany = null;
    }
  }

  goToPageOne() {
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 15;
    this.currentPage = 1;
  }

  // ==================== CONTACT CRUD OPERATIONS ====================
  createContact() {
    if (!this.currentUser?.user?.profileCompletion) {
      if (this.currentUser?.user?.isAdmin) {
        this.showErrorToast('Please complete your user profile before creating contact');
      } else {
        this.showErrorToast(
          'Please contact your administration to complete your user profile before creating contact'
        );
      }
      return;
    }

    this.selectedContactData = null;
    this.contactModalRef = this._modalService.open(this.createContactModel, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
      windowClass: 'custom-lead-modal'
    });
  }

  updateContact(dropdown: NgbDropdown, contact: any): void {
    this.selectedContactData = contact;
    dropdown.close();
    this.contactModalRef = this._modalService.open(this.createContactModel, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
      windowClass: 'custom-lead-modal'
    });
  }

  createdUpdatedContact() {
    this.selectedContactData = null;
    this.goToPageOne();
    this.getRecordsList();
    if (this.contactModalRef) {
      this.contactModalRef.close();
      this.contactModalRef = null;
    }
  }

  confirmDeleteContact(dropdown: NgbDropdown, contact: any): void {
    this.selectedContactData = contact;
    dropdown.close();
    this._modalService.open(this.confirmDeleteModal, {
      centered: true,
      size: 'md',
      backdrop: 'static'
    });
  }

  deleteContact(modal: NgbModalRef) {
    if (!this.selectedContactData) return;

    const payload = {
      _id: this.selectedContactData._id
    };

    this.showLoader();

    this._contactService
      .deleteContact(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.showSuccessToast('Contact deleted successfully!');
          modal.close();
          this.getRecordsList();
        },
        error: (err) => {
          this.showErrorToast(err?.error?.message || 'Failed to delete contact');
          this.hideLoader();
        },
        complete: () => this.hideLoader()
      });
  }

  // ============================================================================
  // UPLOAD MODAL - Enhanced like batch call module
  // ============================================================================

  openUploadModal() {
    console.log('🚀 [UPLOAD] Opening upload modal');
    this.resetUploadState();
    this.uploadModalRef = this._modalService.open(this.uploadContactsModal, {
      centered: true,
      size: 'xl',
      backdrop: 'static',
      windowClass: 'custom-upload-modal'
    });
  }

  resetUploadState() {
    console.log('🔄 [UPLOAD] Resetting upload state');
    this.selectedFile = null;
    this.csvData = [];
    this.csvHeaders = [];
    this.showCsvTable = false;
    this.uploadError = '';
    this.csvError = '';
    this.totalRowsCount = 0;
    this.isDragOver = false;
  }

  // ============================================================================
  // DRAG AND DROP HANDLERS
  // ============================================================================

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    console.log('📁 [FILE-DROP] Files dropped:', files?.length);
    if (files && files.length > 0) {
      this.handleFileSelection(files[0]);
    }
  }

  // ============================================================================
  // FILE SELECTION AND VALIDATION
  // ============================================================================

  onFileSelectedFromModal(event: any) {
    const file = event.target.files[0];
    console.log('📁 [FILE-SELECT] File selected from input:', file?.name);
    if (file) {
      this.handleFileSelection(file);
    }
    event.target.value = '';
  }

  handleFileSelection(file: File) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 [FILE-SELECTION] Starting file selection process');
    console.log('📄 File name:', file.name);
    console.log('📊 File size:', this.formatBytes(file.size));
    console.log('🏷️  File type:', file.type);

    this.uploadError = '';
    this.csvError = '';
    this.csvData = [];
    this.csvHeaders = [];
    this.showCsvTable = false;
    this.totalRowsCount = 0;

    // Validate file type
    console.log('🔍 [VALIDATION] Checking file type...');
    if (!this.isValidFileType(file)) {
      console.error('❌ [VALIDATION] Invalid file type');
      this.uploadError = 'Invalid file format. Please upload CSV or Excel file (.csv, .xlsx, .xls)';
      return;
    }
    console.log('✅ [VALIDATION] File type is valid');

    // Validate file size (10MB)
    console.log('🔍 [VALIDATION] Checking file size...');
    if (!this.validateFileSize(file)) {
      console.error('❌ [VALIDATION] File size exceeds limit');
      this.uploadError = 'File size exceeds 10MB limit';
      return;
    }
    console.log('✅ [VALIDATION] File size is valid');

    this.selectedFile = file;
    console.log('✅ [FILE-SELECTION] File validated successfully, starting parse...');
    this.parseExcelFileForPreview(file);
  }

  isValidFileType(file: File): boolean {
    const allowedTypes = [
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const fileName = file.name.toLowerCase();

    const typeMatch = allowedTypes.includes(file.type);
    const extensionMatch = allowedExtensions.some((ext) => fileName.endsWith(ext));

    return typeMatch || extensionMatch;
  }

  validateFileSize(file: File, maxSizeMB: any = 10): boolean {
    const maxFileSize = maxSizeMB * 1024 * 1024;
    return file.size <= maxFileSize;
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // ============================================================================
  // EXCEL FILE PARSING - EXACTLY LIKE BATCH CALL
  // ============================================================================

  parseExcelFileForPreview(file: File): void {
    console.log('📊 [FILE-PARSE] Starting file parsing');

    const isCSV = file.name.toLowerCase().endsWith('.csv') ||
      file.type === 'text/csv' ||
      file.type === 'application/csv';

    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);

        const workbook = XLSX.read(data, {
          type: 'array',
          cellText: false,
          cellDates: false,
          raw: true,
          cellNF: false,
          codepage: isCSV ? 65001 : undefined
        });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

        // Find and convert phone_number column
        let phoneColumnIndex = -1;

        for (let col = range.s.c; col <= range.e.c; col++) {
          const headerCell = worksheet[XLSX.utils.encode_cell({ r: 0, c: col })];
          const headerValue = headerCell?.v ? String(headerCell.v).toLowerCase().trim() : '';

          if (headerValue === 'phone_number') {
            phoneColumnIndex = col;
            break;
          }
        }

        // Convert phone numbers with FULL PRECISION
        if (phoneColumnIndex !== -1) {
          for (let row = range.s.r + 1; row <= range.e.r; row++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: phoneColumnIndex });
            const cell = worksheet[cellAddress];

            if (cell && cell.v !== undefined && cell.v !== null) {
              if (cell.t === 'n') {
                const numValue = Number(cell.v);
                cell.v = numValue.toLocaleString('fullwide', { useGrouping: false });
              } else {
                cell.v = String(cell.v);
              }

              cell.t = 's';
              delete cell.w;
              delete cell.z;
            }
          }
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          defval: ''
        }) as any[][];

        let csvContent = jsonData
          .map((row) => {
            return row
              .map((cell) => {
                const cellStr = String(cell || '').trim();
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                  return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
              })
              .join(',');
          })
          .join('\n');

        this.processPreviewContent(csvContent);

      } catch (error) {
        console.error('❌ [FILE-PARSE] Error reading file:', error);
        this.csvError = 'Error reading file for preview';
        this.showCsvTable = false;
      }
    };

    reader.onerror = (error) => {
      console.error('❌ [FILE-PARSE] FileReader error:', error);
      this.csvError = 'Error reading file';
      this.showCsvTable = false;
    };

    reader.readAsArrayBuffer(file);
  }

  // ============================================================================
  // PROCESS PREVIEW CONTENT
  // ============================================================================

  processPreviewContent(csvContent: string) {
    console.log('🔍 [PREVIEW-PROCESS] Starting preview content processing');

    try {
      const lines = csvContent.split('\n').filter((line) => line.trim());

      if (lines.length === 0) {
        this.csvError = 'File is empty';
        this.showCsvTable = false;
        return;
      }

      this.csvHeaders = this.parseExcelLine(lines[0]).map((h) => h.trim().toLowerCase());

      const missingHeaders = this.expectedHeaders.filter(
        (expected) => !this.csvHeaders.includes(expected)
      );

      if (missingHeaders.length > 0) {
        this.showErrorToast(`Missing required columns: ${missingHeaders.join(', ')}`);
        this.selectedFile = null;
        this.csvError = `Missing required columns: ${missingHeaders.join(', ')}`;
        this.showCsvTable = false;
        return;
      }

      this.totalRowsCount = lines.length - 1;
      this.csvData = [];
      const dataLines = lines.slice(1);

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];

        if (line.trim()) {
          const rowData = this.parseExcelLine(line);
          const hasData = rowData.some((cell) => cell && cell.trim() !== '');

          if (hasData) {
            const rowObject: any = {};

            this.csvHeaders.forEach((header, index) => {
              let cellValue = rowData[index] || '';

              if (header === 'phone_number' && cellValue) {
                cellValue = this.formatPhoneNumber(cellValue);
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
      console.error('❌ [PREVIEW-PROCESS] Error parsing file content:', error);
      this.csvError = 'Error parsing file content';
      this.showCsvTable = false;
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
      const num = Number(cleaned);
      if (!isNaN(num)) {
        return num.toLocaleString('fullwide', { useGrouping: false });
      }
    }

    return cleaned;
  }

  // ============================================================================
  // FILE MANAGEMENT
  // ============================================================================

  deleteFile() {
    this.selectedFile = null;
    this.csvData = [];
    this.csvHeaders = [];
    this.showCsvTable = false;
    this.csvError = '';
    this.uploadError = '';
    this.totalRowsCount = 0;
  }

  getFileName(): string {
    return this.selectedFile?.name || '';
  }

  getFileSize(): string {
    if (!this.selectedFile) return '';
    return this.formatBytes(this.selectedFile.size);
  }

  getColumnValue(row: any, columnName: string, rowIndex: number): string {
    return row[columnName] || '-';
  }

  getTotalRowsCount(): number {
    return this.totalRowsCount;
  }

  // ============================================================================
  // UPLOAD FUNCTIONALITY
  // ============================================================================

  uploadContactsFile() {
    if (!this.selectedFile) {
      this.uploadError = 'Please select a file to upload.';
      return;
    }

    if (this.csvData.length === 0) {
      this.uploadError = 'No valid data found in file.';
      return;
    }

    console.log('📤 [UPLOAD] Starting file upload');

    const formData = new FormData();
    formData.append('file', this.selectedFile);


    this.isUploading = true;
    this.showLoader();

    this._contactService
      .uploadContacts(formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          console.log('✅ [UPLOAD] Upload successful:', response);
          this.isUploading = false;
          this.hideLoader();
          this.lastUploadResponse = response?.data;

          // Close upload modal
          if (this.uploadModalRef) {
            this.uploadModalRef.close();
            this.uploadModalRef = null;
          }

          // Show response modal
          this._modalService.open(this.uploadResponseModal, {
            centered: true,
            size: 'lg',
            backdrop: 'static'
          });

          // Refresh list
          this.goToPageOne();
          this.getRecordsList();

          // Reset upload state
          this.resetUploadState();
        },
        error: (err) => {
          console.error('❌ [UPLOAD] Upload failed:', err);
          this.isUploading = false;
          this.hideLoader();
          this.uploadError = err?.error?.message || 'Failed to upload contacts';
        }
      });
  }

  downloadValidationReport() {
    if (this.lastUploadResponse?.validationReport?.buffer) {
      const { buffer, fileName, mimeType } = this.lastUploadResponse.validationReport;

      try {
        const byteCharacters = atob(buffer);
        const byteNumbers = new Array(byteCharacters.length);

        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName || 'contact_upload_errors.xlsx';

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

      } catch (error) {
        console.error('❌ [DOWNLOAD] Error downloading file:', error);
        this.showErrorToast('Failed to download error report');
      }
    }
  }

  openSuggestionsModal() {
    this._modalService.open(this.suggestionsModal, {
      centered: true,
      size: 'md',
      backdrop: 'static'
    });
  }

  downloadSampleFile() {
    const sampleData = [
      ['phone_number', 'first_name', 'last_name', 'email', 'gender', 'salutation', 'client_id', 'country'],
      ['+4910000000000', 'Michael', 'Brown', 'michael.b@example.com', 'Masculine', 'Herr', '1005', 'Germany']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');

    worksheet['!cols'] = [
      { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 25 },
      { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 10 }
    ];

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'contact_upload_sample.xlsx');
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  exportContact(): void {
    this.showLoader();
    this.recordsFilter.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this._contactService.exportCall(this.recordsFilter).subscribe(
      (res: any) => {
        try {
          const blob = new Blob([res], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `contact-list-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
}
