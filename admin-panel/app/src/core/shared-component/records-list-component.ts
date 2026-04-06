import { FluentAdminAppComponent } from './fluent-admin-app.component';
export abstract class RecordsListComponent<
  T extends { _id?: string }
> extends FluentAdminAppComponent {
  /**
   * The field stores the total record count.
   */
  public totalCount: any;

  /**
   * Array to hold the values of current view list
   */
  public recordsList = [] as T[];

  /**
   * Options for page sizes available with pageSizeSelector
   */
  public pageSizeOptions = [10, 20, 50, 100, 500];

  public showPageSizeOptions = true;

  public hidePageSize = false;

  public pageIndex = 0;

  public showFirstLastButtons = true;

  public disabled = false;

  /**
   * Current page in the record list
   */
  public currentPage = 1;

  /**
   * Current page size, defult is set to first value of pageSizeOptions
   */
  public currentPageSize = this.pageSizeOptions[0];

  /**
   * Search
   */
  public searchString = '';

  /**
   * Default sort configuration for the screen.
   */
  public sortStates: any;

  /**
   * Set Currrent record.
   */
  public currentRecord: any;

  /**
   * A standard filter to querying the data.
   */
  public recordsFilter: any = {
    skip: 0,
    sortBy: '_id desc',
    limit: 10
  };

  /**
   * Maintain state of advanced filters on screen, which are hidded by defult.
   */
  public filtersShown = true;

  /**
   * Maintain action permission object for list view
   */
  public actionPermission = {
    find: false,
    create: false,
    archive: false,
    update: false,
    findById: false
  };

  /**
   * Toggles filters on screen.
   */
  public toggleFilters(): void {
    this.filtersShown = !this.filtersShown;
  }

  /**
   *
   * The function is used to trigger the search with a custom value and field name
   *
   * @param field       Field name to search
   * @param value       Value to be searched for the field
   */
  public searchCustomByValue(field: string, value: any) {
    if (value !== undefined && value !== null && value !== '') {
      this.recordsFilter.skip = 0;
      this.recordsFilter.limit = this.currentPageSize;
      this.recordsFilter[field] = value;
      this.pageIndex = 0;
    } else {
      delete this.recordsFilter[field];
    }
    this.getRecordsList();
  }

  /**
   * Search a value defined in searchOption with support of search filters tools
   */
  public search($event: any) {
    const value = $event;
    if (value !== undefined && value !== null && value !== '') {
      this.recordsFilter.skip = 0;
      this.recordsFilter.limit = this.currentPageSize;
      this.recordsFilter.searchStr = value;
      this.pageIndex = 0;
    } else {
      this.recordsFilter.searchStr = '';
    }
    this.recordsFilter.skip = 0;
    this.getRecordsList();
  }

  /**
   * Clear the search option in search filter tool, support search filter tool.
   */
  public clearSearch() {
    this.recordsFilter.searchStr = '';
    this.getRecordsList();
  }

  /**
   * The function is used for pager and triggers when a page is changes in
   * pager bar.
   */
  public pageChanged(event: any) {
    while (this.recordsList.length > 0) {
      this.recordsList.pop();
    }
    this.pageIndex = event - 1;
    this.recordsFilter.limit = this.currentPageSize;
    this.currentPageSize = this.currentPageSize;
    this.recordsFilter.skip = this.currentPageSize * this.pageIndex;
    this.getRecordsList();
  }

  /**
   * The function trigger the sort on field specified in the input parameter.
   * It toggle the sort order from asc -> desc, vice versa
   *
   * @param field       Name of the field to sort.
   */
  public onSort(field: any) {
    for (const k in this.sortStates) {
      if (k === field) {
        if (this.sortStates[k] === '') {
          this.sortStates[k] = 'asc';
          this.recordsFilter.sortBy = field + ' asc';
        } else if (this.sortStates[k] === 'asc') {
          this.sortStates[k] = 'desc';
          this.recordsFilter.sortBy = field + ' desc';
        } else if (this.sortStates[k] === 'desc') {
          this.sortStates[k] = 'asc';
          this.recordsFilter.sortBy = field + ' asc';
        }
      } else {
        this.sortStates[k] = '';
      }
    }
    this.recordsFilter.skip = 0;
    this.getRecordsList();
  }

  /**
   * Triggers when page size is changed, support page size selector tool.
   *
   * @param size        New Page size to be set for the record list UI.
   *
   */
  public listSizeChanged(size: any) {
    this.currentPageSize = parseInt(size, 10);
    this.recordsFilter.limit = this.currentPageSize;
    this.getRecordsList();
  }

  /**
   *
   * The function is used to reload the record lists. The function is generally
   * executed when a complete list refresh is required, for example in case the
   * sort order is changed, filters are changed, current page changed etc.
   *
   * Abstract function that must be implemented by the calling component
   *
   */
  abstract getRecordsList(): void;
}
