import { Component, OnInit, TemplateRef, Inject } from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { BlackListService } from 'app/src/shared/services/api/black-list.service';
import { CompanyService } from 'app/src/shared/services/api/company.service';
import { AuthService } from 'app/src/shared/services/auth/auth-service';
import { ActivatedRoute, Router } from '@angular/router';
import { AppComponent } from 'app/app.component';
import { RecordsListComponent } from 'app/src/core/shared-component';

@Component({
  selector: 'app-blacklisted-numbers',
  templateUrl: './blacklisted-numbers.component.html',
  styleUrl: './blacklisted-numbers.component.scss'
})
export class BlacklistedNumbersComponent extends RecordsListComponent<any> {
  blackList: any[] = [];
  selectedItem: any = null;
  selectedUser: any;
  clearFilter: boolean = false;
  selectedText: string = '';

  companyListing: any[] = [];
  companyId: string | null = null;
  currentUser: any;
  currentSort: any;

  override sortStates: any = {
    toNumber: 'desc',
    email: 'desc',
    updatedAt: 'desc'
  };

  constructor(
    @Inject(AppComponent) appComponent: AppComponent,
    private blackListService: BlackListService,
    private modalService: NgbModal,
    private companyService: CompanyService,
    private authService: AuthService,
    private activatedRoute: ActivatedRoute,
    private router: Router
  ) {
    super(appComponent);
    this.currentUser = this.authService.getCurrentUser()?.user;

    if (this.currentUser?.isSuperAdmin) {
      this.getCompanyListing();
    }
    this.companyId = this.currentUser?.companyId;
    this.recordsFilter.companyId = this.companyId;
    this.recordsFilter.sortBy = 'updatedAt desc';
    this.currentSort = 'toNumber';
    this.getRecordsList();
  }

  getRecordsList() {
    this.showLoader(); // ← ADD LOADER START

    this.blackListService.getListing(this.recordsFilter).subscribe({
      next: (response: any) => {
        this.blackList = response?.data || [];
        this.totalCount = response?.totalCount;
        this.hideLoader(); // ← ADD LOADER END
      },
      error: (err) => {
        this.hideLoader();
        this.showErrorToast('Something went wrong while loading data.');
      }
    });
  }

  // Load company list
  getCompanyListing() {
    this.companyService.getCompanyFilterList().subscribe((res: any) => {
      this.companyListing =
        res?.data?.companies?.map((c: any) => ({
          ...c,
          fullName: c.name.length > 15 ? c.name.slice(0, 15) + '…' : c.name
        })) || [];
    });
  }

  selectCompany(selectedCompanyId: any) {
    this.recordsFilter.companyId = selectedCompanyId;
    this.goToPageOne();
    this.getRecordsList();
  }

  openDeleteModal(template: TemplateRef<any>, item: any) {
    this.selectedItem = item;
    this.modalService.open(template, { centered: true, size: 'md' });
  }

  confirmDelete(modal: NgbModalRef) {
    this.showLoader(); // START LOADER

    this.blackListService.deleteRecord(this.selectedItem?._id).subscribe({
      next: () => {
        this.hideLoader(); // STOP LOADER
        modal.close();
        this.showSuccessToast('Record deleted successfully.');
        this.getRecordsList();
      },
      error: (err) => {
        this.hideLoader();
        this.showErrorToast('Unable to delete record.');
      }
    });
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

  goToPageOne() {
    this.recordsFilter.skip = 0;
    this.pageIndex = 0;
    this.currentPageSize = 10;
    this.currentPage = 1;
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
}
