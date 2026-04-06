import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

// search module
import { NgPipesModule } from 'ngx-pipes';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { LayoutsModule } from './src/core/layouts/layouts.module';
import { DashboardModule } from './src/modules/dashboard/dashboard.module';

// Auth
import {
  HttpClient,
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi
} from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { environment } from './src/environments/environment';
import { JwtInterceptor } from './src/shared/services/auth/jwt.interceptor';
import { NgxSpinnerModule } from 'ngx-spinner';
import { ToastrModule } from 'ngx-toastr';
import { AuthService } from './src/shared/services/auth/auth-service';

// Language
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';

// Store
import { rootReducer } from './src/store';
import { StoreModule } from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { EffectsModule } from '@ngrx/effects';
export function createTranslateLoader(http: HttpClient): any {
  return new TranslateHttpLoader(http, 'src/assets/i18n/', '.json');
}

@NgModule({
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  imports: [
    TranslateModule.forRoot({
      defaultLanguage: 'en',
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient]
      }
    }),
    BrowserAnimationsModule,
    BrowserModule,
    AppRoutingModule,
    LayoutsModule,
    StoreModule.forRoot(rootReducer),
    StoreDevtoolsModule.instrument({
      maxAge: 25, // Retains last 25 states
      logOnly: environment.production // Restrict extension to log-only mode
    }),
    DashboardModule,
    NgxSpinnerModule,
    ToastrModule.forRoot({
      timeOut: 10000,
      positionClass: 'toast-top-right',
      preventDuplicates: false,
      closeButton: true,
      enableHtml: true
    }),
    NgPipesModule
  ],
  providers: [
    AuthService,
    { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },
    provideHttpClient(withInterceptorsFromDi())
  ]
})
export class AppModule {}
