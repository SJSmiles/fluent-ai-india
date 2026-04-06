import { Injectable, Injector } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
  HttpResponse
} from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, filter, take, switchMap, finalize, timeout } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from './auth-service';
import { NgxSpinnerService } from 'ngx-spinner';
import { ToastrService } from 'ngx-toastr';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);
  private authService?: AuthService;

  constructor(
    public router: Router,
    private injector: Injector,
    public _ngxSpinnerService: NgxSpinnerService,
    public _toastService: ToastrService
  ) {}

  private getAuthService(): AuthService {
    if (!this.authService) {
      this.authService = this.injector.get(AuthService);
    }
    return this.authService;
  }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Add authorization header with jwt token if available
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      request = this.addTokenHeader(request, accessToken);
    } else {
      request = request.clone({
        setHeaders: {},
        withCredentials: true
      });
    }

    return next.handle(request).pipe(
      switchMap((event: HttpEvent<any>) => {
        if (event instanceof HttpResponse) {
          if (event.body && event.body.accessToken) {
            localStorage.setItem('accessToken', event.body.accessToken);
          }
        }
        return [event];
      }),
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          // Try to refresh token if 401 unauthorized
          return this.handle401Error(request, next, error);
        }
        return throwError(() => error);
      })
    );
  }

  private addTokenHeader(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        'accept-language': localStorage.getItem('lang') || 'en',
        Authorization: `Bearer ${token}`
      },
      withCredentials: true
    });
  }

  private handle401Error(
    request: HttpRequest<any>,
    next: HttpHandler,
    error: any
  ): Observable<HttpEvent<any>> {
    console.error('401 error intercepted:');

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      // Use getAuthService() instead of this.authService
      return this.getAuthService()
        .refreshToken()
        .pipe(
          switchMap((response: any) => {
            this.isRefreshing = false;
            const newToken = response;
            if (newToken) {
              this.refreshTokenSubject.next(newToken);
              const retriedRequest = this.addTokenHeader(request, newToken);
              return next.handle(retriedRequest);
            } else {
              throw new Error('No access token received from refresh');
            }
          }),
          catchError((err) => {
            this.isRefreshing = false;
            this._ngxSpinnerService.hide();

            // Force logout as a safety measure
            try {
              this.getAuthService().logout();
            } catch (logoutError) {
              console.error('Error during interceptor logout:', logoutError);
            }

            // Navigate to login page directly as final failsafe
            this.router.navigate(['/auth/login']);
            return throwError(() => error);
          }),
          finalize(() => {
            // Reset refreshing state in finalize to ensure it's always called
            this.isRefreshing = false;
          })
        );
    } else {
      // If refresh is already in progress, wait for it to complete
      return this.refreshTokenSubject.pipe(
        filter((token) => token != null),
        take(1),
        switchMap((token) => {
          return next.handle(this.addTokenHeader(request, token));
        }),
        catchError((err) => {
          // Force logout and redirect to login
          try {
            this.getAuthService().logout();
          } catch (logoutError) {
            console.error('Error during forced logout:', logoutError);
          }

          // Navigate to login page directly
          this.router.navigate(['/auth/login']);
          return throwError(() => error);
        }),
        // Add timeout to prevent waiting indefinitely
        timeout(10000), // 10 second timeout
        catchError((timeoutErr) => {
          // Force logout on timeout
          this.getAuthService().logout();
          this.router.navigate(['/auth/login']);
          return throwError(() => error);
        })
      );
    }
  }
}
