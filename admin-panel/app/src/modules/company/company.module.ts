import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { SharedModule } from 'app/src/shared/shared.module';
import { CompanyComponent } from './components/company/company.component';
import { CompanyRoutingModule } from './company-routing.module';
import { CreateCompanyComponent } from './components/company/forms/create-company/create-company.component';
import { AgentMappingComponent } from './components/company/forms/agent-mapping/agent-mapping.component';

@NgModule({
  declarations: [CompanyComponent, CreateCompanyComponent, AgentMappingComponent],
  imports: [CompanyRoutingModule, SharedModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class CompanyModule {}
