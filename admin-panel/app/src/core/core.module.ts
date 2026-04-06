import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';

// Components
import { SearchFiltersComponent } from './shared-component';
import { ControlMessagesComponent } from './components/control-messages';
import { SortIconComponent } from './shared-component/table-sort/sort-icon.component';
import { InfiniteScrollDirective } from './directives/infinite-scroll.directive';
import { TitleCaseDirective } from './directives';
import { TranslateModule } from '@ngx-translate/core';
import { FILTERS } from './lib/pipes';

@NgModule({
  imports: [CommonModule, FormsModule, NgSelectModule, TranslateModule],
  declarations: [
    SearchFiltersComponent,
    ControlMessagesComponent,
    InfiniteScrollDirective,
    TitleCaseDirective,
    SortIconComponent,
    FILTERS
  ],
  exports: [
    SearchFiltersComponent,
    ControlMessagesComponent,
    InfiniteScrollDirective,
    TitleCaseDirective,
    SortIconComponent,
    FILTERS
  ],
  providers: []
})
export class CoreModule {}
