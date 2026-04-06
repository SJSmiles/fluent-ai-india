import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { UserRoutingModule } from './users-routing.module';
import { SharedModule } from 'app/src/shared/shared.module';
import { UserComponent } from './components/user/user.component';
import { CreateUserComponent } from './components/create-user/create-user.component';
import { ChangePasswordComponent } from './components/change-password/change-password.component';

@NgModule({
  declarations: [UserComponent, CreateUserComponent, ChangePasswordComponent],
  imports: [UserRoutingModule, SharedModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class UserModule {
  constructor() {}
}
