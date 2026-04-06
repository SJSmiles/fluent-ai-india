// src/app/app.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';
import { AuthService } from './src/shared/services/auth/auth-service';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Fluent Admin';
  currentUser: any;

  constructor(
    public _ngxSpinnerService: NgxSpinnerService,
    public _toastService: ToastrService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.checkAndSetCurrentUser();
  }

  private checkAndSetCurrentUser(): void {
    try {
      const storedUser = localStorage.getItem('currentUser');
      const accessToken = localStorage.getItem('accessToken');
      if (storedUser && accessToken) {
        const userData = JSON.parse(storedUser);
        const user = this.authService.setCurrentUser(userData);
        if (user) {
          this.currentUser = user;
        } else {
          this.clearInvalidSession();
        }
      }
    } catch (error) {
      console.error('Error checking stored user session:', error);
      this.clearInvalidSession();
    }
  }

  private clearInvalidSession(): void {
    localStorage.clear();
    this.currentUser = null;
    this.router.navigate(['/auth/login']);
  }

  showSuccessModal(message: string, title: string): void {
    Swal.fire({
      title: title,
      text: message,
      icon: 'success',
      showCancelButton: false,
      confirmButtonColor: 'rgb(3, 142, 220)',
      cancelButtonColor: 'rgb(243, 78, 78)',
      confirmButtonText: 'Close'
    });
  }

  showErrorModal(message: string, title: string): void {
    Swal.fire({
      title: title,
      html: message,
      icon: 'warning',
      showCancelButton: false,
      confirmButtonColor: 'rgb(255, 0, 0)',
      cancelButtonColor: 'rgb(255, 0, 0)',
      confirmButtonText: 'Close'
    });
  }
}
