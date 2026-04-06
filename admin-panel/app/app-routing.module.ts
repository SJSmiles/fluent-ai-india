import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LayoutComponent } from './src/core/layouts/layout.component';

// Auth

import { AuthGuard } from './src/core/guards/auth.guard';

const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('../app/src/modules/auth/auth.module').then((m) => m.AccountModule)
  },
  {
    path: '',
    canActivate: [AuthGuard],
    component: LayoutComponent,
    loadChildren: () =>
      import('./src/modules/dashboard/dashboard.module').then((m) => m.DashboardModule)
  },
  {
    path: 'batch-call',
    canActivate: [AuthGuard],
    component: LayoutComponent,
    loadChildren: () =>
      import('./src/modules/batch-call/batch-call.module').then((m) => m.BatchCallModule)
  },
  {
    path: 'agent',
    canActivate: [AuthGuard],
    component: LayoutComponent,
    loadChildren: () => import('./src/modules/agent/agent.module').then((m) => m.AgentModule)
  },
  {
    path: 'user',
    canActivate: [AuthGuard],
    component: LayoutComponent,
    loadChildren: () => import('./src/modules/user/users.module').then((m) => m.UserModule)
  },
  {
    path: 'signature-key',
    canActivate: [AuthGuard],
    component: LayoutComponent,
    loadChildren: () =>
      import('./src/modules/user-api-key/user-api-key.module').then((m) => m.UserApiKeyModule)
  },
  {
    path: 'company',
    canActivate: [AuthGuard],
    component: LayoutComponent,
    loadChildren: () => import('./src/modules/company/company.module').then((m) => m.CompanyModule)
  },
  {
    path: 'contact',
    canActivate: [AuthGuard],
    component: LayoutComponent,
    loadChildren: () => import('./src/modules/contact/contacts.module').then((m) => m.ContactModule)
  },
  {
    path: 'blacklisted-numbers',
    canActivate: [AuthGuard],
    component: LayoutComponent,
    loadChildren: () =>
      import('./src/modules/blacklisted-numbers/blacklisted-number.module').then(
        (m) => m.BlacklistedNumbersModule
      )
  },
  {
    path: 'template',
    canActivate: [AuthGuard],
    component: LayoutComponent,
    loadChildren: () => import('./src/modules/template/template.module').then((m) => m.TemplateModule)
  },
  {
    path: 'phone-number',
    canActivate: [AuthGuard],
    component: LayoutComponent,
    loadChildren: () => import('./src/modules/phone-number/phone-number.module').then((m) => m.PhoneNumberModule)
  },
  {
    path: '**',
    redirectTo: 'auth/404page'
  }

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
