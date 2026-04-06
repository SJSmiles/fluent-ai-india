import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  SimpleChange
} from '@angular/core';
import { AppComponent } from 'app/app.component';
import { FluentAdminAppComponent } from 'app/src/core/shared-component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CustomValidators } from 'app/src/core/lib/custom-validators';
import { UserService } from 'app/src/shared/services/';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { AuthService } from 'app/src/shared/services/auth/auth-service';

@Component({
  selector: 'app-create-user',
  templateUrl: './create-user.component.html',
  styleUrl: './create-user.component.scss'
})
export class CreateUserComponent extends FluentAdminAppComponent implements OnDestroy, OnInit {
  @Input() selectedUserData: any = null;
  @Input() currentUser: any = null;
  @Input() selectedCompany: any = null; // Add this input
  @Output() createdUpdatedUser = new EventEmitter<any>();
  @Input() selectedCompanyDomain: string = '';

  private destroy$ = new Subject<void>();
  submitted = false;
  recordForm!: FormGroup;
  selectedRecord: any;
  selectedDomain: any;
  showPassword: boolean = false;
  showBmbyPassword: boolean = false;
  bmbyConfig: boolean = false;

  constructor(
    private appComponent: AppComponent,
    private _userService: UserService,
    private _modalService: NgbModal,
    private _formBuilder: FormBuilder
  ) {
    super(appComponent);
  }

  ngOnInit(): void {
    this.setValueInform();
  }

  public ngOnChanges(changes: { [propKey: string]: SimpleChange }): void {
    if ('currentUser' in changes) {
      this.currentUser = changes['currentUser'].currentValue;
      this.selectedDomain = this.currentUser.user.email.split('@')[1];
      this.updateBmbyConfig();
    }

    if ('selectedCompany' in changes) {
      this.selectedCompany = changes['selectedCompany'].currentValue;
      this.updateBmbyConfig();
    }

    if ('selectedCompanyDomain' in changes) {
      this.selectedCompanyDomain = changes['selectedCompanyDomain'].currentValue;
      this.setDomain();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // New method to update bmbyConfig based on user role
  updateBmbyConfig(): void {
    if (this.currentUser?.user?.isSuperAdmin) {
      this.bmbyConfig = this.selectedCompany?.bmbyConfig || false;
    } else {
      this.bmbyConfig = this.currentUser?.user?.bmbyConfig || false;
    }
  }

  setDomain(): void {
    if (this.currentUser?.user?.isSuperAdmin) {
      if (this.selectedCompanyDomain) {
        this.selectedDomain = this.selectedCompanyDomain;
      } else if (this.selectedCompany?.domain) {
        this.selectedDomain = this.selectedCompany.domain;
      } else {
        this.selectedDomain = this.currentUser.user.email.split('@')[1];
      }
    } else {
      this.selectedDomain = this.currentUser.user.email.split('@')[1];
    }
  }

  allowOnlyPlusAndDigits(event: KeyboardEvent) {
    const pattern = /[0-9\+]/;
    const inputChar = String.fromCharCode(event.keyCode);

    if (!pattern.test(inputChar)) {
      event.preventDefault();
    }
    const currentValue = (event.target as HTMLInputElement).value;
    if (inputChar === '+' && currentValue.length > 0) {
      event.preventDefault();
    }
  }

  setValueInform() {
    this.recordForm = this._formBuilder.group({
      _id: [this.selectedUserData ? this.selectedUserData?._id : { value: null, disabled: true }],
      firstName: [
        this.selectedUserData?.firstName || null,
        [Validators.required, CustomValidators.requiredWithTrim, Validators.maxLength(50)]
      ],
      lastName: [
        this.selectedUserData?.lastName || null,
        [Validators.required, CustomValidators.requiredWithTrim, Validators.maxLength(50)]
      ],
      phoneNumber: [
        this.selectedUserData?.phoneNumber || null,
        [Validators.pattern(/^\+\d{8,15}$/)]
      ],
      email: [
        this.selectedUserData ? { value: this.selectedUserData?.email, disabled: true } : null,
        [Validators.required, CustomValidators.emailLocalPartValidator, Validators.maxLength(150)]
      ],
      status: [this.selectedUserData?.status ?? true],
      password: [
        this.selectedUserData ? { value: null, disabled: true } : null,
        [
          Validators.required,
          CustomValidators.requiredWithTrim,
          Validators.minLength(8),
          Validators.maxLength(128),
          CustomValidators.passwordStrengthValidator
        ]
      ],
      bmbyUserId: [
        this.selectedUserData?.bmbyUserId || null,
        [Validators.maxLength(50), CustomValidators.optionalWithTrim]
      ],
      bmbyProjectId: [
        this.selectedUserData?.bmbyProjectId || null,
        [Validators.maxLength(50), CustomValidators.optionalWithTrim]
      ]
    });

    // Normalize status
    if (this.recordForm.value.status === 0) {
      this.recordForm.patchValue({ status: false });
    } else if (this.recordForm.value.status === 1) {
      this.recordForm.patchValue({ status: true });
    }

    // Disable bmby fields if they have existing values
    if (this.selectedUserData?.bmbyUserId) {
      this.recordForm.get('bmbyUserId')?.disable();
    }
    if (this.selectedUserData?.bmbyProjectId) {
      this.recordForm.get('bmbyProjectId')?.disable();
    }
  }

  close() {
    this._modalService.dismissAll();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleBmbyPasswordVisibility() {
    this.showBmbyPassword = !this.showBmbyPassword;
  }

  submit() {
    this.submitted = true;
    if (this.recordForm.value.status === false) {
      this.recordForm.value.status = 0;
    } else if (this.recordForm.value.status === true) {
      this.recordForm.value.status = 1;
    }
    if (this.recordForm.valid) {
      if (this.selectedUserData?._id) {
        this.showLoader();
        this._userService.update(this.recordForm.value).subscribe({
          next: (response: any) => {
            this.showSuccessToast('User updated successfully!');
            this.createdUpdatedUser.emit();
          },
          error: (error: any) => {
            this.hideLoader();
            this.showErrorToast(error?.error?.message || 'Error updating user');
          }
        });
      } else {
        const domain = this.selectedDomain;
        const email = this.recordForm.value?.email;
        const combinedEmail = email + '@' + domain;
        this.recordForm.value.email = combinedEmail;

        // Add companyId for super admin ONLY
        if (this.currentUser?.user?.isSuperAdmin && this.selectedCompany?._id) {
          this.recordForm.value.companyId = this.selectedCompany._id;
        }

        this.showLoader();
        this._userService.create(this.recordForm.value).subscribe({
          next: (response: any) => {
            this.showSuccessToast('User created successfully!');
            this.createdUpdatedUser.emit();
          },
          error: (error: any) => {
            this.recordForm.value.email = combinedEmail.split('@')[0];
            this.hideLoader();
            this.showErrorToast(error?.error?.message || 'Error creating user');
          }
        });
      }
    }
  }
}
