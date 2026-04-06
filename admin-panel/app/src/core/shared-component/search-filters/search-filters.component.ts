import { Component, Output, EventEmitter, Input, SimpleChange } from '@angular/core';

@Component({
  selector: 'app-search-filters',
  templateUrl: './search-filters.component.html',
  styleUrls: ['./search-filters.component.scss']
})
export class SearchFiltersComponent {
  @Output() public search = new EventEmitter<any>();
  @Output() public onValueInsert = new EventEmitter<string>();
  @Input() public clear: any;
  @Input() public selectedText: any;
  @Input() public emitOnValueInsert: boolean = false; // New input property
  public searchString = '';
  searchActive = true;

  public searchItem(searchString: any) {
    if (searchString !== '') {
      this.searchActive = false;
      this.search.emit(searchString);
    }
  }

  public ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
    if ('clear' in changes) {
      if (
        changes['clear'].currentValue !== undefined &&
        changes['clear'].currentValue !== null &&
        changes['clear'].currentValue
      ) {
        this.clear = changes['clear'].currentValue;
        this.searchString = '';
        this.searchActive = true;
      }
    }
    if ('selectedText' in changes) {
      if (
        changes['selectedText'].currentValue !== undefined &&
        changes['selectedText'].currentValue !== null &&
        changes['selectedText'].currentValue
      ) {
        this.selectedText = changes['selectedText'].currentValue;
        this.searchString = this.selectedText;
        this.searchActive = false;
      } else {
        this.searchString = '';
        this.searchActive = true;
      }
    }
  }

  public onSearch(searchString: any, searchActiveFlag: any) {
    if (searchString !== '') {
      if (searchActiveFlag) {
        this.searchActive = false;
        this.search.emit(this.searchString);
      } else {
        this.searchString = '';
        if (this.emitOnValueInsert) {
          // Check the new input property
          this.onValueInsert.emit(searchString);
        }
        this.searchActive = true;
        this.search.emit('');
      }
    } else {
      if (!searchActiveFlag) {
        this.searchString = '';
        this.searchActive = true;
        this.search.emit('');
      }
    }
  }

  onChange(value: any) {
    this.searchString = value;
    if (value === '') {
      this.searchActive = true;
      this.search.emit('');
    }
    if (this.emitOnValueInsert) {
      this.onValueInsert.emit(this.searchString);
    }
  }
}
