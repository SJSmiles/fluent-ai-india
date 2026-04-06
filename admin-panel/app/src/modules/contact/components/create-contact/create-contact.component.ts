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
import { ContactService } from 'app/src/shared/services/api/contact.service';
import { CompanyService } from 'app/src/shared/services/api/company.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-create-contact',
  templateUrl: './create-contact.component.html',
  styleUrls: ['./create-contact.component.scss']
})
export class CreateContactComponent extends FluentAdminAppComponent implements OnDestroy, OnInit {
  @Input() selectedContactData: any = null;
  @Input() currentUser: any = null;
  @Input() selectedCompany: any = null;
  @Output() createdUpdatedContact = new EventEmitter<any>();

  private destroy$ = new Subject<void>();
  submitted = false;
  recordForm!: FormGroup;

  countryList = [
    { label: 'Germany', value: 'Germany' },
  ];

  salutationOptions = [
    { label: 'Herr', value: 'Herr' },
    { label: 'Frau', value: 'Frau' }
  ];

  genderOptions = [
    { label: 'Masculine', value: 'masculine' },
    { label: 'Feminine', value: 'feminine' },
    { label: 'Neuter', value: 'neuter' },
  ];

  constructor(
    private appComponent: AppComponent,
    private _contactService: ContactService,
    private _modalService: NgbModal,
    private _formBuilder: FormBuilder
  ) {
    super(appComponent);
  }

  ngOnInit(): void {
    this.setValueInForm();
  }

  public ngOnChanges(changes: { [propKey: string]: SimpleChange }): void {
    if ('currentUser' in changes) {
      this.currentUser = changes['currentUser'].currentValue;
    }

    if ('selectedCompany' in changes) {
      this.selectedCompany = changes['selectedCompany'].currentValue;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

  setValueInForm() {
    this.recordForm = this._formBuilder.group({
      _id: [this.selectedContactData ? this.selectedContactData?._id : { value: null, disabled: true }],
      salutation: [this.selectedContactData?.salutation || null],
      firstName: [
        this.selectedContactData?.firstName || null,
        [Validators.maxLength(50)]
      ],
      lastName: [
        this.selectedContactData?.lastName || null,
        [Validators.maxLength(50)]
      ],
      gender: [this.selectedContactData?.gender || null],
      email: [
        this.selectedContactData?.email || null,
        [
          Validators.required,
          CustomValidators.emailValidator,
          Validators.maxLength(100)
        ]
      ],
      number: [
        this.selectedContactData?.number || null,
        [Validators.required, CustomValidators.phoneNumberValidator]
      ],
      country: [this.selectedContactData?.country || null],
      bmbyId: [
        this.selectedContactData?.bmbyId || null,
        [Validators.required, Validators.maxLength(50)]
      ]
    });
  }

  close() {
    this._modalService.dismissAll();
  }

  submit() {
    this.submitted = true;

    if (this.recordForm.valid) {
      const formData = { ...this.recordForm.value };

      // Remove empty optional fields
      if (!formData.salutation) delete formData.salutation;
      if (!formData.gender) delete formData.gender;
      if (!formData.country) delete formData.country;
      if (!formData.bmbyId) delete formData.bmbyId;

      if (this.selectedContactData?._id) {
        this.showLoader();
        this._contactService
          .update(formData)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response: any) => {
              this.showSuccessToast('Contact updated successfully!');
              this.createdUpdatedContact.emit();
            },
            error: (error: any) => {
              this.hideLoader();
              this.showErrorToast(error?.error?.message || 'Error updating contact');
            }
          });
      } else {
        this.showLoader();
        this._contactService
          .create(formData)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response: any) => {
              this.showSuccessToast('Contact created successfully!');
              this.createdUpdatedContact.emit();
            },
            error: (error: any) => {
              this.hideLoader();
              this.showErrorToast(error?.error?.message || 'Error creating contact');
            }
          });
      }
    }
  }
}