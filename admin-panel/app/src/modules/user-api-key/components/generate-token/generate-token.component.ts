import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AppComponent } from 'app/app.component';
import { FluentAdminAppComponent, RecordsListComponent } from 'app/src/core/shared-component';
import { UserService } from 'app/src/shared/services';

@Component({
  selector: 'app-generate-token',
  templateUrl: './generate-token.component.html',
  styleUrls: ['./generate-token.component.scss']
})
export class GenerateTokenComponent extends FluentAdminAppComponent implements OnInit {
  @Input() companyId: string = '';
  @Input() currentUser: any;
  @Output() tokenGeneratedSuccessfully = new EventEmitter<void>();

  tokenForm!: FormGroup;
  usersList: any[] = [];
  isSubmitting: boolean = false;
  isSuperAdmin: boolean = false;
  minDate: Date;
  selectedExpiryOption: string = '24h';

  expiryOptions = [
    { value: '24h', label: '24 H' },
    { value: '3d', label: '3 Days' },
    { value: '1w', label: '1 Week' },
    { value: '1m', label: '1 Month' },
    { value: '6m', label: '6 Months' },
    { value: '1y', label: '1 Year' },
    { value: 'custom', label: 'Custom' }
  ];

  constructor(
    private fb: FormBuilder,
    private _userService: UserService,
    private appComponent: AppComponent
  ) {
    super(appComponent);
    this.minDate = new Date();
  }

  ngOnInit(): void {
    // Get super admin status from currentUser
    this.isSuperAdmin = this.currentUser?.user?.isSuperAdmin || false;

    this.initForm();
    this.getUsersList();
    // Set default expiry to 24 hours from now
    this.setExpiryTime('24h');
  }

  initForm(): void {
    // Initialize with empty email if super admin, otherwise use current user's email
    const defaultEmail = this.isSuperAdmin ? '' : this.currentUser?.user?.email || '';

    this.tokenForm = this.fb.group({
      userEmail: [defaultEmail, Validators.required],
      expiryTime: ['', Validators.required]
    });
  }

  getUsersList(): void {
    const filter = {
      skip: 0,
      limit: 1000,
      companyId: this.companyId
    };

    this._userService.listing(filter).subscribe(
      (response: any) => {
        this.usersList = (response?.data || []).map((user: any) => ({
          ...user,
          fullName: `${user.firstName} ${user.lastName} (${user.email})`
        }));

        // Set default user after list is loaded
        this.setDefaultUser();
      },
      (err) => {
        console.error('Error fetching users:', err);
      }
    );
  }

  setDefaultUser(): void {
    if (this.isSuperAdmin) {
      if (this.usersList.length > 0) {
        this.tokenForm.patchValue({
          userEmail: this.usersList[0].email
        });
      } else {
        const currentUserEmail = this.currentUser?.user?.email;
        const userExists = this.usersList.some((user) => user.email === currentUserEmail);

        if (!userExists && this.usersList.length > 0) {
          this.tokenForm.patchValue({
            userEmail: this.usersList[0].email
          });
        }
      }
    }
  }

  selectExpiryOption(option: string): void {
    this.selectedExpiryOption = option;

    if (option !== 'custom') {
      this.setExpiryTime(option);
    } else {
      this.tokenForm.patchValue({ expiryTime: '' });
    }
  }

  setExpiryTime(option: string): void {
    const now = new Date();
    let expiryDate: Date;

    switch (option) {
      case '24h':
        expiryDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case '3d':
        expiryDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        break;
      case '1w':
        expiryDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case '1m':
        expiryDate = new Date(now);
        expiryDate.setMonth(expiryDate.getMonth() + 1);
        break;
      case '6m':
        expiryDate = new Date(now);
        expiryDate.setMonth(expiryDate.getMonth() + 6);
        break;
      case '1y':
        expiryDate = new Date(now);
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        break;
      default:
        return;
    }

    this.tokenForm.patchValue({ expiryTime: expiryDate });
  }

  onDateSelected(date: Date): void {
    this.tokenForm.patchValue({ expiryTime: date });
  }

  onSubmit(): void {
    if (this.tokenForm.invalid) {
      Object.keys(this.tokenForm.controls).forEach((key) => {
        this.tokenForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isSubmitting = true;
    const formValue = this.tokenForm.value;

    // Convert date to ISO string format
    const expiryDate = new Date(formValue.expiryTime);
    const expiryTimeISO = expiryDate.toISOString();

    const payload = {
      email: formValue.userEmail,
      expiryTime: expiryTimeISO // Will be in format: "2025-10-04T12:30:00.000Z"
    };

    this._userService.generateToken(payload).subscribe(
      (response: any) => {
        this.isSubmitting = false;
        this.tokenGeneratedSuccessfully.emit();
        this.showSuccessToast(response.message);
        // Show success message if you have a toast service
      },
      (err) => {
        this.isSubmitting = false;
        // Show error message
        this.showErrorToast(err.error.message);
      }
    );
  }

  closeModal(): void {
    this.tokenGeneratedSuccessfully.emit();
  }

  get f() {
    return this.tokenForm.controls;
  }
}
