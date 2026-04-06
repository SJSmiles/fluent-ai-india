import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { AppComponent } from 'app/app.component';
import { RecordsListComponent } from 'app/src/core/shared-component';
import { UserService } from 'app/src/shared/services';
import { AuthService } from 'app/src/shared/services/auth/auth-service';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { CompanyService } from 'app/src/shared/services/api/company.service';

@Component({
  selector: 'app-signature-key',
  templateUrl: './signature-key.component.html',
  styleUrls: ['./signature-key.component.scss']
})
export class SignatureKeyComponent extends RecordsListComponent<any> implements OnInit, OnDestroy {
  @ViewChild('generateTokenModel') generateTokenModel!: TemplateRef<any>;
  tokenModalRef: NgbModalRef | null = null;
  @ViewChild('confirmModal') confirmModal!: TemplateRef<any>;
  selectedRecord: any = null;
  private destroy$ = new Subject<void>();
  currentSort: any;
  currentUser: any;
  companyId: string = ''; // You can set this from current user or route params
  copiedIndex: number | null = null;
  companyListing: any;
  companyListLoaded: boolean = false;

  constructor(
    private appComponent: AppComponent,
    private _userService: UserService,
    private _modalService: NgbModal,
    private authService: AuthService,
    private router: Router,
    private _companyService: CompanyService
  ) {
    super(appComponent);
    this.authService.currentUser$.subscribe((user: any) => {
      this.currentUser = user;
      this.companyId = this.currentUser?.user?.companyId || null;
      if (this.companyId) {
        this.recordsFilter.companyId = this.companyId;
      }
      if (this.currentUser?.user?.isSuperAdmin && !this.companyListLoaded) {
        this.companyListLoaded = true;
        this.getCompanyListing();
      }
      this.companyId = user?.user?.companyId || '';
      this.recordsFilter.sortBy = 'createdAt desc';
      this.recordsFilter.skip = 0;
      this.recordsFilter.limit = 10;
      this.currentSort = 'createdAt';
    });
  }

  override sortStates: any = {
    userEmail: '',
    expiryTime: '',
    createdAt: 'desc'
  };

  ngOnInit(): void {
    if (this.currentUser?.user?.isAdmin && this.currentUser?.user?.sheetConfig) {
      this.getRecordsList();
    } else {
      this.router.navigate(['/auth/404page']);
    }
  }

  getRecordsList(): void {
    this.showLoader();

    const filter = {
      ...this.recordsFilter,
      companyId: this.companyId
    };

    this._userService
      .signatureListing(filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          this.recordsList = response?.data;
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
    this.goToPageOne();
    this.getRecordsList();
  }

  goToPageOne() {
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 10;
    this.currentPage = 1;
  }

  generateToken() {
    this.tokenModalRef = this._modalService.open(this.generateTokenModel, {
      centered: true,
      size: 'md',
      backdrop: 'static',
      windowClass: 'custom-token-modal'
    });
  }

  tokenGeneratedSuccessfully() {
    this.goToPageOne();
    this.getRecordsList();
    if (this.tokenModalRef) {
      this.tokenModalRef.close();
      this.tokenModalRef = null;
    }
  }

  copyToken(token: string, index: number) {
    if (!token) return;

    navigator.clipboard.writeText(token).then(
      () => {
        // Show toast
        this.showSuccessToast('Token copied to clipboard!');

        // Optional: still track copiedIndex for icon change if desired
        this.copiedIndex = index;
        setTimeout(() => {
          this.copiedIndex = null;
        }, 2000);
      },
      (err) => {
        console.error('Failed to copy token:', err);
        this.showErrorToast('Failed to copy token!');
      }
    );
  }

  confirmDeactivate(record: any) {
    if (!record.isActive) return; // Already inactive, button disabled
    this.selectedRecord = record;
    this._modalService.open(this.confirmModal, {
      centered: true,
      size: 'md',
      backdrop: 'static'
    });
  }

  // Call API to deactivate
  deactivateKey(modal: NgbModalRef) {
    if (!this.selectedRecord) return;

    const payload = {
      _id: this.selectedRecord._id,
      isActive: false
    };

    this.showLoader();

    this._userService
      .inactiveToken(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.showSuccessToast('API Key deactivated successfully!');
          modal.close();
          this.getRecordsList(); // Refresh table
        },
        error: (err) => {
          this.showErrorToast(err?.error?.message || 'Failed to deactivate API key');
          this.hideLoader();
        },
        complete: () => this.hideLoader()
      });
  }

  selectCompany(event: any) {
    if (event) {
      this.recordsFilter.companyId = event;
      this.companyId = event;
    } else {
      delete this.recordsFilter.companyId;
      this.companyId = '';
    }

    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 10;
    this.currentPage = 1;
    this.getRecordsList();
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
}
