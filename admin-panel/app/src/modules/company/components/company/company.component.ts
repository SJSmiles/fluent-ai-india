import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NgbDropdown, NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { AppComponent } from 'app/app.component';
import { RecordsListComponent } from 'app/src/core/shared-component';
import { AuthService } from 'app/src/shared/services/auth/auth-service';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { CompanyService } from 'app/src/shared/services/api/company.service';
import { AgentService } from 'app/src/shared/services/api/agent.services';

@Component({
  selector: 'app-company',
  templateUrl: './company.component.html',
  styleUrls: ['./company.component.scss']
})
export class CompanyComponent extends RecordsListComponent<any> implements OnInit, OnDestroy {
  @ViewChild('createCompanyModel') createCompanyModel!: TemplateRef<any>;
  @ViewChild('agentMappingModel') agentMappingModel!: TemplateRef<any>;
  @ViewChild('pullAgentConfirmModal') pullAgentConfirmModal!: TemplateRef<any>;
  @ViewChild('generateTokenConfirmModal') generateTokenConfirmModal!: TemplateRef<any>;
  @ViewChild('confirmModal') confirmModal!: TemplateRef<any>;

  companyModalRef: NgbModalRef | null = null;
  agentMappingModalRef: NgbModalRef | null = null;
  companyUsersModalRef: NgbModalRef | null = null;
  pullAgentModalRef: NgbModalRef | null = null;

  private destroy$ = new Subject<void>();
  private allCompanies: any[] = [];
  currentSort: any;
  selectedText: string = '';
  clearFilter: boolean = false;
  selectedCompanyData: any;
  selectedCompanyForPullAgent: any = null;
  currentUser: any;
  copiedIndex: number | null = null;
  companyId: any;

  voiceProviders = [
    { value: 'vapi', label: 'VAPI' },
    { value: 'retell', label: 'RETELL' }
  ];
  selectedVoiceProvider: string = 'vapi';
  selectedCompanyForGenerateToken: any;

  constructor(
    private appComponent: AppComponent,
    private _companyService: CompanyService,
    private _modalService: NgbModal,
    private authService: AuthService,
    private _agentService: AgentService,
    private router: Router
  ) {
    super(appComponent);
    this.authService.currentUser$.subscribe((user: any) => {
      this.currentUser = user;
      this.companyId = this.currentUser?.user?.companyId || null;
      this.recordsFilter.sortBy = 'createdAt desc';
      this.currentSort = 'createdAt';
    });
  }

  override sortStates: any = {
    name: '',
    createdAt: 'desc'
  };

  ngOnInit(): void {
    this.getRecordsList();
  }

  getRecordsList(): void {
    this.showLoader();
    this._companyService
      .listing(this.recordsFilter)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response: any) => {
          this.recordsList = response?.data?.companies || [];
          this.totalCount = response?.data?.pagination?.total || 0;
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
      this.recordsFilter.search = event;
    } else {
      delete this.recordsFilter.search;
    }
    this.goToPageOne();
    this.getRecordsList();
  }

  createCompany() {
    this.selectedCompanyData = null;
    this.companyModalRef = this._modalService.open(this.createCompanyModel, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
      windowClass: 'custom-company-modal'
    });
  }

  updateCompany(dropdown: NgbDropdown, company: any): void {
    this.selectedCompanyData = company;
    dropdown.close();
    this.companyModalRef = this._modalService.open(this.createCompanyModel, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
      windowClass: 'custom-company-modal'
    });
  }

  createdUpdatedCompany() {
    this.selectedCompanyData = null;
    this.goToPageOne();
    this.getRecordsList();
    if (this.companyModalRef) {
      this.companyModalRef.close();
      this.companyModalRef = null;
    }
  }

  agentMapping(dropdown: NgbDropdown, company: any): void {
    this.selectedCompanyData = company;
    dropdown.close();
    this.agentMappingModalRef = this._modalService.open(this.agentMappingModel, {
      centered: true,
      size: 'xl',
      backdrop: 'static',
      windowClass: 'custom-agent-mapping-modal'
    });
  }

  mappingComplete() {
    this.selectedCompanyData = null;
    if (this.agentMappingModalRef) {
      this.agentMappingModalRef.close();
      this.agentMappingModalRef = null;
    }
  }

  pullAgent(dropdown: NgbDropdown, company: any): void {
    this.selectedCompanyForPullAgent = company;
    this.selectedVoiceProvider = 'vapi';
    dropdown.close();

    // Open confirmation modal
    this.pullAgentModalRef = this._modalService.open(this.pullAgentConfirmModal, {
      centered: true,
      size: 'md',
      backdrop: 'static'
    });
  }

  confirmPullAgent(modal: any): void {
    modal.close();
    this.showLoader();

    const payload = {
      companyId: this.selectedCompanyForPullAgent._id,
      voiceProvider: this.selectedVoiceProvider
    };

    this._agentService.pullAgent(payload).subscribe({
      next: (response) => {
        this.showSuccessToast('Agents pulled successfully');
        this.hideLoader();
        this.selectedCompanyForPullAgent = null;
        this.selectedVoiceProvider = 'vapi';
      },
      error: (error) => {
        this.showErrorToast(error.error.message || 'Failed to pull agents');
        this.hideLoader();
        this.selectedCompanyForPullAgent = null;
        this.selectedVoiceProvider = 'vapi';
      }
    });
  }

  companyUsers(dropdown: NgbDropdown, company: any): void {
    dropdown.close();

    this.router.navigate(['/user'], {
      queryParams: {
        companyId: company._id
      }
    });
  }

  goToPageOne() {
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 10;
    this.currentPage = 1;
  }

  copyToken(token: string, index: number) {
    if (!token) return;

    navigator.clipboard.writeText(token).then(
      () => {
        this.showSuccessToast('Token copied to clipboard!');
        this.copiedIndex = index;
        setTimeout(() => {
          this.copiedIndex = null;
        }, 2000);
      },
      (err) => {
        this.showErrorToast('Failed to copy token!');
      }
    );
  }

  // Open confirmation modal for both activate and deactivate
  confirmToggleStatus(record: any) {
    this.selectedCompanyData = record;
    this._modalService.open(this.confirmModal, {
      centered: true,
      size: 'md',
      backdrop: 'static'
    });
  }

  // Toggle company status (activate or deactivate)
  toggleCompanyStatus(modal: NgbModalRef) {
    if (!this.selectedCompanyData) return;

    const newStatus = !this.selectedCompanyData.isActive;

    const payload = {
      _id: this.selectedCompanyData._id,
      isActive: newStatus
    };

    this.showLoader();

    this._companyService
      .toggleStatus(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const action = newStatus ? 'activated' : 'deactivated';
          this.showSuccessToast(`Company ${action} successfully!`);
          modal.close();
          this.getRecordsList(); // Refresh table
        },
        error: (err) => {
          const action = newStatus ? 'activate' : 'deactivate';
          this.showErrorToast(err?.error?.message || `Failed to ${action} company`);
          this.hideLoader();
        },
        complete: () => this.hideLoader()
      });
  }

  generateToken(dropdown: NgbDropdown, company: any): void {
    this.selectedCompanyForGenerateToken = company;
    dropdown.close();

    // Open confirmation modal
    this.pullAgentModalRef = this._modalService.open(this.generateTokenConfirmModal, {
      centered: true,
      size: 'md',
      backdrop: 'static'
    });
  }

  generateCompanyToken(modal: any): void {
    modal.close();
    this.showLoader();

    const payload = {
      companyId: this.selectedCompanyForGenerateToken._id
    };

    this._companyService.generateCompanyToken(payload).subscribe({
      next: (response) => {
        this.showSuccessToast('New Token Generated successfully');
        this.selectedCompanyForGenerateToken = null;
        this.getRecordsList();
      },
      error: (error) => {
        this.showErrorToast(error.error.message || 'Failed to generate new token');
        this.hideLoader();
        this.selectedCompanyForGenerateToken = null;
      }
    });
  }
}
