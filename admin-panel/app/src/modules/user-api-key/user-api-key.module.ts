import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { SharedModule } from 'app/src/shared/shared.module';
import { SignatureKeyComponent } from './components/signature-key';
import { UserApiKeyRoutingModule } from './user-api-key-routing.module';
import { GenerateTokenComponent } from './components/generate-token/generate-token.component';

@NgModule({
  declarations: [SignatureKeyComponent, GenerateTokenComponent],
  imports: [UserApiKeyRoutingModule, SharedModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class UserApiKeyModule {
  constructor() {}
}
