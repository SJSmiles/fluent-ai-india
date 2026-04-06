import { Component, EventEmitter, Inject, Input, Output, SimpleChange } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AppComponent } from 'app/app.component';
import { CustomValidators } from 'app/src/core/lib';
import { FluentAdminAppComponent } from 'app/src/core/shared-component';
import { UserService } from 'app/src/shared/services';

@Component({
  selector: 'app-change-password',
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.scss']
})
export class ChangePasswordComponent extends FluentAdminAppComponent {
  @Output() passwordChangedSucessfull = new EventEmitter<any>();
  @Input() selectedUserData: any;
  @Input() currentUser: any;
  @Input() isSuperAdmin: boolean = false;

  recordForm: any;
  submitted = false;
  showPassword: boolean = false;
  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;
  passwordStrength: { percentage: number; color: string; message: string } = {
    percentage: 0,
    color: '#dc3545',
    message: 'Very Weak'
  };
  hasMinLength: boolean = false;
  hasUpperCase: boolean = false;
  hasLowerCase: boolean = false;
  hasNumber: boolean = false;
  hasSpecialChar: boolean = false;
  passwordValidation: any;

  constructor(
    @Inject(UserService) private _userService: UserService,
    @Inject(NgbModal) private _modalService: NgbModal,
    @Inject(AppComponent) private appComponent: AppComponent,
    private _formBuilder: FormBuilder
  ) {
    super(appComponent);
  }

  public ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
    if ('currentUser' in changes) {
      this.currentUser = changes['currentUser'].currentValue;
      // Update isSuperAdmin from currentUser if not explicitly passed
      if (!this.isSuperAdmin && this.currentUser?.user?.isSuperAdmin) {
        this.isSuperAdmin = this.currentUser.user.isSuperAdmin;
      }
    }

    if ('isSuperAdmin' in changes) {
      this.isSuperAdmin = changes['isSuperAdmin'].currentValue;
    }

    if ('selectedUserData' in changes) {
      this.selectedUserData = changes['selectedUserData'].currentValue;
      this.setValueInform();
    }
  }

  ngOnInit() {
    // Ensure isSuperAdmin is set from currentUser if available
    if (!this.isSuperAdmin && this.currentUser?.user?.isSuperAdmin) {
      this.isSuperAdmin = this.currentUser.user.isSuperAdmin;
    }
  }

  // Custom validator for password match
  passwordMatchValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const newPassword = control.get('newPassword');
      const confirmPassword = control.get('confirmPassword');

      if (!newPassword || !confirmPassword) {
        return null;
      }

      if (confirmPassword.value === '') {
        return null;
      }

      return newPassword.value === confirmPassword.value ? null : { passwordMismatch: true };
    };
  }

  setValueInform() {
    const requireCurrentPassword = this.selectedUserData?.isAdmin === true && !this.isSuperAdmin;

    this.recordForm = this._formBuilder.group(
      {
        currentPassword: [
          requireCurrentPassword ? null : { value: null, disabled: true },
          requireCurrentPassword ? [Validators.required] : []
        ],
        newPassword: [null, [CustomValidators.passwordStrengthValidator]],
        confirmPassword: [null, [Validators.required]],
        _id: [this.selectedUserData?._id || null]
      },
      {
        validators: this.passwordMatchValidator()
      }
    );
  }

  closeModels() {
    this._modalService.dismissAll();
  }

  changeUserPassword() {
    this.submitted = true;

    if (this.recordForm.valid) {
      this.showLoader();

      // Prepare payload - only include currentPassword if it's enabled
      const payload: any = {
        newPassword: this.recordForm.value.newPassword,
        _id: this.recordForm.value._id
      };

      // Only add currentPassword if the field is enabled and has a value
      if (
        this.recordForm.get('currentPassword')?.enabled &&
        this.recordForm.value.currentPassword
      ) {
        payload.currentPassword = this.recordForm.value.currentPassword;
      }

      this._userService.changePassword(payload).subscribe(
        (response) => {
          this.showSuccessToast(`Password changed successfully`);
          this.submitted = false;
          this.passwordChangedSucessfull.emit();
          this._modalService.dismissAll();
          this.hideLoader();
        },
        (err) => {
          const errorMessage = 'Changing password';
          this.showErrorToast(`Error in ${errorMessage}: ${err.error.message}`);
          this.hideLoader();
        }
      );
    }
  }

  preventEnter(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 'Enter') {
      keyboardEvent.preventDefault();
    }
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleNewPasswordVisibility() {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
}
