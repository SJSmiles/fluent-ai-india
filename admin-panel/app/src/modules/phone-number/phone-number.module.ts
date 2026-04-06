import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { PhoneNumberRoutingModule } from './phone-number-routing.module';
import { SharedModule } from 'app/src/shared/shared.module';
import { PhoneNumberComponent } from './components/phone-number/phone-number.component';
import { CreatePhoneNumberComponent } from './components/create-phone-number/create-phone-number.component';

@NgModule({
  declarations: [PhoneNumberComponent, CreatePhoneNumberComponent],
  imports: [PhoneNumberRoutingModule, SharedModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class PhoneNumberModule {
  constructor() { }
}
