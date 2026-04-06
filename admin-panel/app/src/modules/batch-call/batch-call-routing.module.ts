import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BatchCallComponent } from './components/batch-call';
import { BatchCallDetailsComponent } from './components/details/details.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: '1',
    pathMatch: 'full'
  },
  {
    path: ':pageNumber',
    component: BatchCallComponent
  },
  {
    path: ':pageNumber/details/:id',
    component: BatchCallDetailsComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BatchCallRoutingModule {}
