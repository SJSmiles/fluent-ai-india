import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, Subject, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { Router } from '@angular/router';
import { UserService } from 'app/src/shared/services';

interface AuthUser {
  accessToken: string;
  user: any;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<AuthUser | null>;
  public currentUser$: Observable<AuthUser | null>;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private _userService: UserService
  ) {
    this.currentUserSubject = new BehaviorSubject<AuthUser | null>(this.getUserFromLocalStorage());
    this.currentUser$ = this.currentUserSubject.asObservable();

    // Initialize user data on app load
    this.initializeAuth();
  }

  private getUserFromLocalStorage(): AuthUser | null {
    const userJson = localStorage.getItem('currentUser');
    return userJson ? JSON.parse(userJson) : null;
  }

  private initializeAuth(): void {
    const currentUser = this.getUserFromLocalStorage();

    // If user exists in localStorage, fetch fresh data from API
    if (currentUser && currentUser.accessToken) {
      this._userService.getCurrentUser().subscribe({
        next: (userData: any) => {
          const updatedUser: AuthUser = {
            accessToken: userData?.newAccessToken || currentUser.accessToken,
            user: userData
          };
          localStorage.setItem('accessToken', userData?.newAccessToken || currentUser.accessToken);
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
          this.currentUserSubject.next(updatedUser);
        },
        error: (error: any) => {
          console.error('Error fetching current user on init:', error);
          // If API fails, clear auth and redirect to login
          this.logout();
        }
      });
    }
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  setCurrentUser(response: any): Observable<boolean> {
    return new Observable((observer) => {
      try {
        const tokenData = response.data;
        const accessToken = tokenData?.accessToken || response?.accessToken;
        const user = tokenData?.user || response?.user;

        if (!accessToken) {
          console.error('No access token found in response');
          observer.next(false);
          observer.complete();
          return;
        }

        const userObj: AuthUser = {
          accessToken: accessToken,
          user: user
        };
        localStorage.setItem('currentUser', JSON.stringify(userObj));
        localStorage.setItem('accessToken', accessToken);
        this.currentUserSubject.next(userObj);

        // Call getCurrentUser API and wait for response
        this._userService.getCurrentUser().subscribe({
          next: (userData: any) => {
            const updatedUser: AuthUser = {
              accessToken: userData?.newAccessToken || accessToken,
              user: userData
            };
            localStorage.setItem('accessToken', userData?.newAccessToken || accessToken);
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            this.currentUserSubject.next(updatedUser);

            // Return true only after everything is stored
            observer.next(true);
            observer.complete();
          },
          error: (error: any) => {
            console.error('Error fetching current user data:', error);
            this.logout();
            observer.next(false);
            observer.complete();
          }
        });
      } catch (error) {
        console.error('Error in setCurrentUser:', error);
        this.logout();
        observer.next(false);
        observer.complete();
      }
    });
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('accessToken');
    this.currentUserSubject.next(null);
    this.router.navigate(['/auth/login']);
  }

  refreshToken(): Observable<string> {
    return this._userService.refreshToken().pipe(
      map((response: any) => {
        if (!response?.data?.accessToken) {
          this.logout();
          throw new Error('Invalid response format from refresh token');
        }
        const updatedUser: AuthUser = {
          accessToken: response?.data?.accessToken,
          user: this.getCurrentUser()?.user
        };
        localStorage.setItem('accessToken', response?.data?.accessToken);
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        this.currentUserSubject.next(updatedUser);
        return response?.data?.accessToken;
      }),
      catchError((error) => {
        try {
          this.logout();
        } catch (logoutError) {
          localStorage.removeItem('currentUser');
          localStorage.removeItem('accessToken');
          this.currentUserSubject.next(null);
        }
        return throwError(() => new Error('Token refresh failed. User has been logged out.'));
      })
    );
  }

  ngOnDestroy(): void {
    this.destroy$.complete();
  }
}
