import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BlacklistedNumbersComponent } from './components/blacklisted-numbers/blacklisted-numbers.component';
const routes: Routes = [
  {
    path: '',
    component: BlacklistedNumbersComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BlacklistedNumbersRoutingModule {}
