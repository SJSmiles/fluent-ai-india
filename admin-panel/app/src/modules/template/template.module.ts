import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TemplateRoutingModule } from './template-routing.module';
import { SharedModule } from 'app/src/shared/shared.module';
import { TemplateComponent } from './components/template/template.component';
import { CreateTemplateComponent } from './components/create-template/create-template.component';

@NgModule({
  declarations: [TemplateComponent, CreateTemplateComponent],
  imports: [TemplateRoutingModule, SharedModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class TemplateModule {
  constructor() {}
}
