import { Component, Inject, Input } from '@angular/core';
import { AppComponent } from 'app/app.component';
import { FluentAdminAppComponent } from 'app/src/core/shared-component/fluent-admin-app.component';
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class headerComponent extends FluentAdminAppComponent {
  @Input() moduleName = '';
  @Input() totalCount = '';

  constructor(@Inject(AppComponent) private appComponent: AppComponent) {
    super(appComponent);
  }
}
