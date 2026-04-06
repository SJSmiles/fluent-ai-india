import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BlacklistedNumbersRoutingModule } from './blacklisted-number-routing.module';
import { SharedModule } from 'app/src/shared/shared.module';
import { BlacklistedNumbersComponent } from './components/blacklisted-numbers/blacklisted-numbers.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
@NgModule({
  declarations: [BlacklistedNumbersComponent],
  imports: [BlacklistedNumbersRoutingModule, SharedModule, NgSelectModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class BlacklistedNumbersModule {}
