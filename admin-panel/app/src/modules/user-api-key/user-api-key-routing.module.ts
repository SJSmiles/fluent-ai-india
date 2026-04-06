import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SignatureKeyComponent } from './components/signature-key';

const routes: Routes = [
  {
    path: '',
    component: SignatureKeyComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UserApiKeyRoutingModule {}
