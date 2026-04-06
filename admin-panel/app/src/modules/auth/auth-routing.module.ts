import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

// Component Pages
import { LoginComponent } from './components/login/login.component';
import { page404Component } from './components/page404/page404.component';

const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: '404page',
    component: page404Component
  },
  {
    path: '**',
    redirectTo: '404page'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AccountRoutingModule {}
