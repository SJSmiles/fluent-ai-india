import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { SharedModule } from 'app/src/shared/shared.module';
import { DashboardComponent } from './components/dashboard';
import { AnalyticsComponent } from './components/analytics/analytics.component';
import { DashboardDetailsComponent } from './components/details/details.component';
import { CreateBatchFromCallsComponent } from './components/create-call-dashboard/create-batch-from-calls.component';
import { DashboardNewComponent } from './components/dashboard-new';
import { AnalyticsNewComponent } from './components/analytics-new/analytics-new.component';
import { DashboardCallDetailsComponent } from './components/call-details/call-details.component';

@NgModule({
  declarations: [
    DashboardComponent,
    DashboardNewComponent,
    AnalyticsNewComponent,
    AnalyticsComponent,
    DashboardDetailsComponent,
    CreateBatchFromCallsComponent,
    DashboardCallDetailsComponent
  ],
  imports: [DashboardRoutingModule, SharedModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class DashboardModule {
  constructor() {}
}
