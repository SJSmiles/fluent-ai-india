// login.component.ts
import { Component, Inject, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  UntypedFormBuilder,
  UntypedFormGroup,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { AppComponent } from 'app/app.component';
import { TESTIMONIAL_DATA } from 'app/src/config/constants/constants';
import { CustomValidators } from 'app/src/core/lib';
import { FluentAdminAppComponent } from 'app/src/core/shared-component';
import { UserService } from 'app/src/shared/services';
import { AuthService } from 'app/src/shared/services/auth/auth-service';

interface SlickConfig {
  slidesToShow: number;
  slidesToScroll: number;
  autoplay: boolean;
  autoplaySpeed: number;
  arrows: boolean;
  dots: boolean;
  infinite: boolean;
  pauseOnHover: boolean;
  pauseOnFocus: boolean;
  fade: boolean;
  cssEase: string;
  customPaging?: (slider: any, i: number) => string;
  responsive?: Array<{
    breakpoint: number;
    settings: {
      autoplaySpeed?: number;
    };
  }>;
}

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent extends FluentAdminAppComponent {
  recordForm!: FormGroup;
  submitted = false;
  loading = false;
  isDarkMode = false;
  isRegisterMode = false;

  slickConfig: SlickConfig = {
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 4000,
    arrows: false,
    dots: true,
    infinite: true,
    pauseOnHover: true,
    pauseOnFocus: true,
    fade: true,
    cssEase: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    customPaging: (slider: any, i: number) => {
      return '<span class="custom-dot"></span>';
    },
    responsive: [
      {
        breakpoint: 768,
        settings: {
          autoplaySpeed: 5000
        }
      }
    ]
  };

  testimonials = TESTIMONIAL_DATA;
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;

  constructor(
    private formBuilder: UntypedFormBuilder,
    private _userService: UserService,
    private _authService: AuthService,
    private router: Router,
    private _formBuilder: FormBuilder,
    @Inject(AppComponent) private appComponent: AppComponent
  ) {
    super(appComponent);
  }

  ngOnInit(): void {
    if (localStorage.getItem('currentUser')) {
      this.router.navigate(['']);
    }

    this.setValueInForm();
  }

  setValueInForm() {
    const formConfig: any = {
      email: ['', [Validators.required, CustomValidators.emailValidator]]
    };

    if (this.isRegisterMode) {
      formConfig.password = [
        '',
        [
          Validators.required,
          CustomValidators.requiredWithTrim,
          CustomValidators.passwordStrengthValidator,
          Validators.minLength(8),
          Validators.maxLength(128)
        ]
      ];
      formConfig.confirmPassword = ['', [CustomValidators.passwordMatch]];
    } else {
      formConfig.password = ['', [Validators.required]];
    }

    this.recordForm = this._formBuilder.group(formConfig);

    if (this.isRegisterMode) {
      this.recordForm.get('password')?.valueChanges.subscribe(() => {
        this.recordForm.get('confirmPassword')?.updateValueAndValidity();
      });
    }
  }

  getStars(rating: number): number[] {
    return Array(rating)
      .fill(0)
      .map((x, i) => i);
  }

  toggleMode(event: Event): void {
    event.preventDefault();
    this.isRegisterMode = !this.isRegisterMode;
    this.submitted = false;
    this.setValueInForm();
  }

  onSubmit(): void {
    this.submitted = true;

    if (this.recordForm.invalid) {
      Object.keys(this.recordForm.controls).forEach((key) => {
        this.recordForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading = true;
    const formValue = this.recordForm.value;

    if (this.isRegisterMode) {
      this.showLoader();

      const registrationPayload = {
        email: formValue.email,
        password: formValue.password,
        confirmPassword: formValue.confirmPassword
      };

      this._userService.registerUser(registrationPayload).subscribe({
        next: () => {
          this.showSuccessToast('Registration successful! Please login.');
          this.isRegisterMode = false;
          this.submitted = false;
          this.setValueInForm();
          this.hideLoader();
        },
        error: (err: any) => {
          const errorMessage = err.error?.message || 'Registration failed. Please try again.';
          this.showErrorToast(errorMessage);
          this.loading = false;
          this.hideLoader();
        },
        complete: () => {
          this.loading = false;
          this.hideLoader();
        }
      });
    } else {
      const userInput = formValue.email;
      const loginPayload: any = {
        password: formValue.password
      };

      loginPayload[userInput.includes('@') ? 'email' : 'username'] = userInput;

      this._userService.loginUser(loginPayload).subscribe({
        next: (response: any) => {
          // Subscribe to setCurrentUser which returns Observable<boolean>
          this._authService.setCurrentUser(response).subscribe({
            next: (success: boolean) => {
              if (success) {
                // Navigate to home only after getCurrentUser is complete
                this.router.navigate(['']);
              } else {
                // Navigate to login if setCurrentUser failed
                this.showErrorToast('Authentication failed. Please try again.');
                this.router.navigate(['/auth/login']);
              }
              this.loading = false;
            },
            error: () => {
              this.showErrorToast('Authentication failed. Please try again.');
              this.router.navigate(['/auth/login']);
              this.loading = false;
            }
          });
        },
        error: (err: any) => {
          const errorMessage = err.error?.message || 'Login failed. Please try again.';
          this.showErrorToast(errorMessage);
          this.loading = false;
          this.router.navigate(['/auth/login']);
        }
      });
    }
  }

  onImageError(event: any, testimonial: any): void {
    event.target.remove();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
}
