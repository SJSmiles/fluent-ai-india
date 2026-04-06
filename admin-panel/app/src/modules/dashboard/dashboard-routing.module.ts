import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard';
import { DashboardNewComponent } from './components/dashboard-new';

const routes: Routes = [
  {
    path: '',
    component:  DashboardNewComponent
  },
  {
    path: 'old',
    component: DashboardComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardRoutingModule {}
