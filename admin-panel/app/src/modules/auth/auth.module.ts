import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { NgbToastModule } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';

// Load Icons
import { defineElement } from '@lordicon/element';
import lottie from 'lottie-web';
import { AccountRoutingModule } from './auth-routing.module';
import { LoginComponent } from './components/login/login.component';
// import { SurveyReviewComponent } from './survey-review/survey-review.component';
import { TranslateModule } from '@ngx-translate/core';
import { SlickCarouselModule } from 'ngx-slick-carousel';
import { SharedModule } from 'app/src/shared/shared.module';

@NgModule({
  declarations: [
    LoginComponent
    // SurveyReviewComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NgbToastModule,
    AccountRoutingModule,
    TranslateModule,
    NgSelectModule,
    SlickCarouselModule,
    SharedModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AccountModule {
  constructor() {
    defineElement(lottie.loadAnimation);
  }
}
