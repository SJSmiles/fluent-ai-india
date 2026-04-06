import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BatchCallRoutingModule } from './batch-call-routing.module';
import { BatchCallComponent } from './components/batch-call/batch-call.component';
import { CreateBatchCallComponent } from './components/create-batch-call/create-batch-call.component';
import { SharedModule } from 'app/src/shared/shared.module';
import { BatchCallDetailsComponent } from './components/details/details.component';
import { RetryFailedCallsComponent } from './components/retry-failed-calls/retry-failed-calls.component';

@NgModule({
  declarations: [
    BatchCallComponent,
    CreateBatchCallComponent,
    BatchCallDetailsComponent,
    RetryFailedCallsComponent
  ],
  imports: [BatchCallRoutingModule, SharedModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class BatchCallModule {}
