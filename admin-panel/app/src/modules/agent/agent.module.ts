import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { SharedModule } from 'app/src/shared/shared.module';
import { AgentRoutingModule } from './agent-routing.module';
import { AgentComponent } from './components/agent/agent.component';
import { CreateAgentComponent } from './components/forms/create-agent/create-agent.component';
import { PostCallAnalysisModalComponent } from './components/forms/post-call-analysis-form/post-call-analysis-modal.component';

@NgModule({
  declarations: [AgentComponent, CreateAgentComponent, PostCallAnalysisModalComponent],
  imports: [AgentRoutingModule, SharedModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AgentModule {}
