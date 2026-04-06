import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PhoneNumberComponent } from './components/phone-number/phone-number.component';

const routes: Routes = [
  {
    path: '',
    component: PhoneNumberComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PhoneNumberRoutingModule { }
