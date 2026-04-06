import { Component, Input, SimpleChange, OnChanges } from '@angular/core';
@Component({
  selector: 'app-sort-icon',
  templateUrl: './sort-icon.component.html'
})
export class SortIconComponent implements OnChanges {
  @Input() public sortState: any;
  public ngOnChanges(changes: { [propKey: string]: SimpleChange }): void {
    if ('sortState' in changes) {
      this.sortState = changes['sortState'].currentValue;
    }
  }
}
