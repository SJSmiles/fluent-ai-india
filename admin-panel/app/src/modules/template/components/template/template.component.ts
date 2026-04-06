import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NgbDropdown, NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { AppComponent } from 'app/app.component';
import { RecordsListComponent } from 'app/src/core/shared-component';
import { TemplateService } from 'app/src/shared/services/api/template-service';
import { AuthService } from 'app/src/shared/services/auth/auth-service';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { CompanyService } from 'app/src/shared/services/api/company.service';

@Component({
  selector: 'app-template',
  templateUrl: './template.component.html',
  styleUrls: ['./template.component.scss']
})
export class TemplateComponent extends RecordsListComponent<any> implements OnInit, OnDestroy {
  @ViewChild('createTemplateModel') createTemplateModel!: TemplateRef<any>;
  @ViewChild('confirmModal') confirmModal!: TemplateRef<any>;
  templateModalRef: NgbModalRef | null = null;
  passwordModalRef: NgbModalRef | null = null;
  private destroy$ = new Subject<void>();
  currentSort: any;
  selectedText: string = '';
  clearFilter: boolean = false;
  selectedUser: any;
  selectedUserData: any;
  currentUser: any;
  companyListing: any;
  companyId: string | null = null;
  companyListLoaded: boolean = false;
  selectedCompany: any = null;
  selectedCompanyDomain: string = '';
  override currentPageSize: any = 15;

  override sortStates: any = {
    name: 'asc'
  };

  constructor(
    private appComponent: AppComponent,
    private _templateService: TemplateService,
    private _companyService: CompanyService,
    private _modalService: NgbModal,
    private authService: AuthService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    super(appComponent);
    this.recordsFilter.limit = 15;
    this.authService.currentUser$.subscribe((user: any) => {
      this.currentUser = user;
      this.recordsFilter.sortBy = '_id desc';
      this.currentSort = 'name';
    });
  }

  ngOnInit(): void {
    // Check for companyId in query params
    this.activatedRoute.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const queryCompanyId = params['companyId'];

      if (this.currentUser?.user?.isSuperAdmin) {
        // Super Admin: Use query param if available, otherwise use their own companyId as default
        if (queryCompanyId) {
          this.companyId = queryCompanyId;
          this.recordsFilter.companyId = queryCompanyId;
        } else {
          // No query param - use super admin's own companyId as default
          const userCompanyId = this.currentUser?.user?.companyId;
          if (userCompanyId) {
            this.companyId = userCompanyId;
            this.recordsFilter.companyId = userCompanyId;

            //Update URL with default companyId
            this.router.navigate([], {
              relativeTo: this.activatedRoute,
              queryParams: { companyId: userCompanyId },
              queryParamsHandling: 'merge',
              replaceUrl: true // Use replaceUrl to avoid adding to history
            });
          }
        }

        // Load company list for super admin
        if (!this.companyListLoaded) {
          this.getCompanyListing(() => {
            this.updateSelectedCompany();
            this.getRecordsList();
          });
        } else {
          this.updateSelectedCompany();
          this.getRecordsList();
        }
      } else {
        // Regular Admin/User: Always use their own company
        const userCompanyId = this.currentUser?.user?.companyId;
        if (userCompanyId) {
          this.companyId = userCompanyId;
          this.recordsFilter.companyId = userCompanyId;
        }
        this.getRecordsList();
      }
    });
  }

  getRecordsList(): void {
    this.showLoader();
    this._templateService
      .listing(this.recordsFilter)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          if (response?.data && Array.isArray(response.data)) {
            this.recordsList = response.data?.templates;
          } else if (response?.data?.templates && Array.isArray(response.data.templates)) {
            this.recordsList = response.data.templates;
          } else {
            this.recordsList = [];
            console.error('Expected array for recordsList, got:', response);
          }
          this.totalCount = response.data?.total;
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

  customSearch(event: any) {
    if (event) {
      this.recordsFilter.searchStr = event;
    } else {
      delete this.recordsFilter.searchStr;
    }
    this.goToPageOne();
    this.getRecordsList();
  }

  createUser() {
    this.selectedUserData = null;
    this.templateModalRef = this._modalService.open(this.createTemplateModel, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
      windowClass: 'custom-lead-modal'
    });
  }

  updateUser(user: any): void {
    this.selectedUserData = user;
    this.templateModalRef = this._modalService.open(this.createTemplateModel, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
      windowClass: 'custom-lead-modal'
    });
  }

  createdUpdatedUser() {
    this.selectedUserData = null;
    this.goToPageOne();
    this.getRecordsList();
    if (this.templateModalRef) {
      this.templateModalRef.close();
      this.templateModalRef = null;
    }
  }

  goToPageOne() {
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 15;
    this.currentPage = 1;
  }


  passwordChangedSucessfull() {
    this.selectedUserData = null;
    if (this.passwordModalRef) {
      this.passwordModalRef.close();
      this.passwordModalRef = null;
    }
  }

  confirmToggleStatus(record: any) {
    this.selectedUserData = record;
    this._modalService.open(this.confirmModal, {
      centered: true,
      size: 'md',
      backdrop: 'static'
    });
  }

  toggleTemplateStatus(modal: NgbModalRef) {
    if (!this.selectedUserData) return;

    const newStatus = this.selectedUserData.isActive ? false : true;

    const payload = {
      _id: this.selectedUserData._id,
      isActive: newStatus
    };

    this.showLoader();

    this._templateService
      .toggleStatus(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const action = newStatus === true ? 'activated' : 'deactivated';
          this.showSuccessToast(`Template ${action} successfully!`);
          modal.close();
          this.getRecordsList();
        },
        error: (err) => {
          const action = newStatus === true ? 'activate' : 'deactivate';
          this.showErrorToast(err?.error?.message || `Failed to ${action} template`);
          this.hideLoader();
        },
        complete: () => this.hideLoader()
      });
  }

  selectCompany(event: any) {
    if (event) {
      this.recordsFilter.companyId = event;
      this.companyId = event;
      this.updateSelectedCompany();

      if (this.currentUser?.user?.isSuperAdmin && this.selectedCompany) {
        this.selectedCompanyDomain = this.selectedCompany.domain;
      }

      // Update URL with new companyId for super admin
      if (this.currentUser?.user?.isSuperAdmin) {
        this.router.navigate([], {
          relativeTo: this.activatedRoute,
          queryParams: { companyId: event },
          queryParamsHandling: 'merge'
        });
      }
    } else {
      //When clearing company selection, default back to super admin's own companyId
      if (this.currentUser?.user?.isSuperAdmin) {
        const userCompanyId = this.currentUser?.user?.companyId;
        if (userCompanyId) {
          this.companyId = userCompanyId;
          this.recordsFilter.companyId = userCompanyId;

          // Update URL
          this.router.navigate([], {
            relativeTo: this.activatedRoute,
            queryParams: { companyId: userCompanyId },
            queryParamsHandling: 'merge'
          });
        }
      } else {
        delete this.recordsFilter.companyId;
        this.companyId = null;
      }

      this.selectedCompany = null;
      this.selectedCompanyDomain = '';
    }

    this.goToPageOne();
    this.getRecordsList();
  }

  updateSelectedCompany() {
    if (this.companyId && this.companyListing) {
      this.selectedCompany = this.companyListing.find(
        (company: any) => company._id === this.companyId
      );

      if (this.currentUser?.user?.isSuperAdmin && this.selectedCompany) {
        this.selectedCompanyDomain = this.selectedCompany.domain;
      }
    } else {
      this.selectedCompany = null;
      if (this.currentUser?.user?.isSuperAdmin) {
        this.selectedCompanyDomain = '';
      }
    }
  }

  getCompanyListing(callback?: () => void) {
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

        this.companyListLoaded = true;
        this.updateSelectedCompany();

        this.hideLoader();

        if (callback) {
          callback();
        }
      },
      (err) => {
        this.showErrorToast(`Error in record fetching: ${err.error?.message || err.message}`);
        this.hideLoader();
      }
    );
  }
}
