import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { NgbDropdownModule, NgbNavModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { SimplebarAngularModule } from 'simplebar-angular';
import { LanguageService } from '../../shared/services/language.service';
import { TranslateModule } from '@ngx-translate/core';
import { NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';

// Component pages
import { LayoutComponent } from './layout.component';
import { VerticalComponent } from './vertical/vertical.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { IconComponent } from 'app/src/core/shared-component/svg/svg.component';
import { CoreModule } from '../core.module';

@NgModule({
  declarations: [LayoutComponent, VerticalComponent, SidebarComponent],
  imports: [
    CommonModule,
    RouterModule,
    NgbDropdownModule,
    NgbNavModule,
    SimplebarAngularModule,
    TranslateModule,
    NgbCollapseModule,
    FormsModule,
    ReactiveFormsModule,
    NgbTooltipModule,
    IconComponent,
    CoreModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [LanguageService]
})
export class LayoutsModule {}
