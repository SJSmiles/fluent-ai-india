import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ContactRoutingModule } from './contacts-routing.module';
import { SharedModule } from 'app/src/shared/shared.module';
import { ContactComponent } from './components/contact/contact.component';
import { CreateContactComponent } from './components/create-contact/create-contact.component';

@NgModule({
  declarations: [ContactComponent, CreateContactComponent],
  imports: [ContactRoutingModule, SharedModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ContactModule {
  constructor() {}
}