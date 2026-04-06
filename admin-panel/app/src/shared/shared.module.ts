import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  NgbNavModule,
  NgbAccordionModule,
  NgbDropdownModule,
  NgbTooltipModule,
  NgbPaginationModule,
  NgbPopoverModule,
  NgbModule
} from '@ng-bootstrap/ng-bootstrap';
import { SlickCarouselModule } from 'ngx-slick-carousel';
import { CountUpModule } from 'ngx-countup';
import { CoreModule } from '../core/core.module';
import { headerComponent } from '../core/shared-component/header/header.component';
import { TranslateModule } from '@ngx-translate/core';
import { IconComponent } from '../core/shared-component/svg/svg.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';
import { NgSelectModule } from '@ng-select/ng-select';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { DateSelectorComponent } from '../core/shared-component/date-selector';
import { SingleDateSelectorComponent } from '../core/shared-component/single-date-selector';
import { PopoverModule } from 'ngx-bootstrap/popover';

@NgModule({
  declarations: [headerComponent, DateSelectorComponent, SingleDateSelectorComponent],
  imports: [
    CommonModule,
    NgbNavModule,
    NgbAccordionModule,
    NgbDropdownModule,
    SlickCarouselModule,
    CountUpModule,
    CoreModule,
    TranslateModule,
    IconComponent,
    NgbPaginationModule,
    FormsModule,
    ReactiveFormsModule,
    CKEditorModule,
    NgSelectModule,
    NgbTooltipModule,
    DragDropModule,
    PopoverModule,
    NgbPopoverModule,
    NgbModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  exports: [
    headerComponent,
    IconComponent,
    DateSelectorComponent,
    DragDropModule,
    NgbDropdownModule,
    CoreModule,
    CommonModule,
    NgSelectModule,
    NgbPaginationModule,
    TranslateModule,
    SingleDateSelectorComponent,
    PopoverModule,
    FormsModule,
    NgbPopoverModule,
    NgbModule,
    ReactiveFormsModule,
    NgbTooltipModule
  ]
})
export class SharedModule {}
