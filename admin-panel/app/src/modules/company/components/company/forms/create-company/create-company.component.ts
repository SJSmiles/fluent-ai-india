import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  SimpleChange
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AppComponent } from 'app/app.component';
import { FluentAdminAppComponent } from 'app/src/core/shared-component';
import { CustomValidators } from 'app/src/core/lib/custom-validators';
import { Subject } from 'rxjs';
import { CompanyService } from 'app/src/shared/services/api/company.service';
interface Country {
  _id: string;
  code: string;
  name: string;
  fullName?: string;
}

interface VoiceProvider {
  value: string;
  label: string;
}

@Component({
  selector: 'app-create-company',
  templateUrl: './create-company.component.html',
  styleUrls: ['./create-company.component.scss']
})
export class CreateCompanyComponent extends FluentAdminAppComponent implements OnInit, OnDestroy {
  @Input() selectedCompanyData: any = null;
  @Input() currentUser: any = null;
  @Output() createdUpdatedCompany = new EventEmitter<any>();

  private destroy$ = new Subject<void>();
  submitted = false;
  companyForm!: FormGroup;
  showPassword: boolean = false;
  selectedDomain: string = '';
  countries: Country[] = [];

  // 🎤 Voice Provider Configuration
  availableVoiceProviders: VoiceProvider[] = [
    { value: 'vapi', label: 'VAPI' },
    { value: 'retell', label: 'Retell' }
  ];

  selectedVoiceProviders: string[] = [];
  apiKeys: { [key: string]: string } = {};

  constructor(
    private appComponent: AppComponent,
    private _companyService: CompanyService,
    private _modalService: NgbModal,
    private _formBuilder: FormBuilder
  ) {
    super(appComponent);
  }

  ngOnInit(): void {
    this.getCountryListing();
    this.setValueInForm();
    this.handleDomainChange();
  }

  public ngOnChanges(changes: { [propKey: string]: SimpleChange }): void {
    if ('selectedCompanyData' in changes) {
      this.selectedCompanyData = changes['selectedCompanyData'].currentValue;
    }
    if ('currentUser' in changes) {
      this.currentUser = changes['currentUser'].currentValue;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Initialize Form Values */
  setValueInForm() {
    const address = this.selectedCompanyData?.address || {
      street: '',
      houseNo: null,
      zipCode: null,
      state: '',
      countryId: null
    };

    if (this.selectedCompanyData?._id) {
      // Edit mode - Load existing voice providers
      if (
        this.selectedCompanyData.voiceProviders &&
        Array.isArray(this.selectedCompanyData.voiceProviders)
      ) {
        this.selectedVoiceProviders = this.selectedCompanyData.voiceProviders.map(
          (vp: any) => vp.name
        );

        // Initialize API keys from existing data
        this.selectedCompanyData.voiceProviders.forEach((vp: any) => {
          // Extract actual API key if it's masked (ends with ...)
          this.apiKeys[vp.name] = vp.api_key_id || '';
        });
      }

      this.companyForm = this._formBuilder.group({
        _id: [this.selectedCompanyData._id],
        name: [
          this.selectedCompanyData.name || null,
          [Validators.required, CustomValidators.requiredWithTrim, Validators.maxLength(50)]
        ],
        address: this._formBuilder.group({
          street: [address.street],
          houseNo: [address.houseNo],
          zipCode: [address.zipCode],
          state: [address.state],
          countryId: [address.country?._id || address.countryId || null]
        }),
        description: [this.selectedCompanyData.description || null, [Validators.maxLength(1000)]],
        isActive: [this.selectedCompanyData.isActive ?? true],
        notInterested: [
          this.selectedCompanyData.notInterested || 1,
          [Validators.required, Validators.min(1), CustomValidators.integerOnlyValidator]
        ],
        interestedTask: [
          this.selectedCompanyData.interestedTask || 1,
          [Validators.required, Validators.min(1), CustomValidators.integerOnlyValidator]
        ],
        interestedMeetingBooked: [
          this.selectedCompanyData.interestedMeetingBooked || 1,
          [Validators.required, Validators.min(1), CustomValidators.integerOnlyValidator]
        ]
      });
    } else {
      // Create mode - Default to VAPI
      this.selectedVoiceProviders = ['vapi'];
      this.apiKeys = { vapi: '' };

      this.companyForm = this._formBuilder.group({
        name: [
          null,
          [Validators.required, CustomValidators.requiredWithTrim, Validators.maxLength(50)]
        ],
        domain: [
          null,
          [Validators.required, CustomValidators.requiredWithTrim, Validators.maxLength(30)]
        ],
        address: this._formBuilder.group({
          street: [''],
          houseNo: [null],
          zipCode: [null],
          state: [''],
          countryId: [null]
        }),
        description: [null, [Validators.maxLength(1000)]],
        email: ['', [Validators.required, Validators.email, Validators.maxLength(50)]],
        password: [
          null,
          [
            Validators.required,
            CustomValidators.requiredWithTrim,
            Validators.minLength(8),
            Validators.maxLength(128)
          ]
        ],
        notInterested: [
          1,
          [Validators.required, Validators.min(1), CustomValidators.integerOnlyValidator]
        ],
        interestedTask: [
          1,
          [Validators.required, Validators.min(1), CustomValidators.integerOnlyValidator]
        ],
        interestedMeetingBooked: [
          1,
          [Validators.required, Validators.min(1), CustomValidators.integerOnlyValidator]
        ]
      });
    }
  }

  /** Handle voice provider selection changes */
  onVoiceProviderChange() {
    // Remove API keys for deselected providers
    const currentKeys = Object.keys(this.apiKeys);
    currentKeys.forEach((key) => {
      if (!this.selectedVoiceProviders.includes(key)) {
        delete this.apiKeys[key];
      }
    });

    // Add empty API key fields for newly selected providers
    this.selectedVoiceProviders.forEach((provider) => {
      if (!this.apiKeys[provider]) {
        this.apiKeys[provider] = '';
      }
    });
  }

  /** Get provider display label */
  getProviderLabel(provider: string): string {
    const found = this.availableVoiceProviders.find((vp) => vp.value === provider);
    return found ? found.label : provider.toUpperCase();
  }

  /** Sync domain with email field */
  handleDomainChange() {
    if (!this.companyForm) return;
    const domainControl = this.companyForm.get('domain');
    const emailControl = this.companyForm.get('email');

    if (domainControl && emailControl) {
      domainControl.valueChanges.subscribe((domainValue) => {
        this.selectedDomain = domainValue || '';

        // Get current email value safely - check if it exists and is a string
        const currentEmail = emailControl.value;
        if (!currentEmail || typeof currentEmail !== 'string') {
          // If email is not set, just update selectedDomain
          return;
        }

        const localPart = currentEmail.includes('@') ? currentEmail.split('@')[0] : currentEmail;

        if (domainValue && domainValue.trim() !== '') {
          // Update email with domain
          emailControl.setValue(`${localPart}@${domainValue}`, { emitEvent: false });
        } else {
          // If domain is cleared, just keep the local part
          emailControl.setValue(localPart, { emitEvent: false });
        }
      });
    }
  }

  /** Email helpers */
  getEmailLocalPart(): string {
    if (!this.companyForm) return '';
    const emailControl = this.companyForm.get('email');
    if (!emailControl) return '';

    const email = emailControl.value;
    if (!email || typeof email !== 'string') return '';

    return email.split('@')[0] || '';
  }

  onEmailLocalPartChange(event: any): void {
    if (!this.companyForm) return;

    const localPart = (event.target.value || '').trim();
    const domain = this.selectedDomain || this.companyForm.get('domain')?.value || '';
    const emailControl = this.companyForm.get('email');

    if (!emailControl) return;

    if (domain && domain.trim() !== '') {
      emailControl.setValue(`${localPart}@${domain}`, { emitEvent: false });
    } else {
      emailControl.setValue(localPart, { emitEvent: false });
    }
  }

  close() {
    this._modalService.dismissAll();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  /** Validate voice providers and API keys */
  validateVoiceProviders(): boolean {
    if (this.selectedVoiceProviders.length === 0) {
      return false;
    }

    for (const provider of this.selectedVoiceProviders) {
      if (!this.apiKeys[provider] || this.apiKeys[provider].trim() === '') {
        return false;
      }
    }

    return true;
  }

  submit() {
    this.submitted = true;

    // Validate voice providers
    const voiceProvidersValid = this.validateVoiceProviders();

    if (this.companyForm.valid && voiceProvidersValid) {
      const payload: any = { ...this.companyForm.value };

      // Build voiceProviders array
      payload.voiceProviders = this.selectedVoiceProviders.map((provider) => ({
        name: provider,
        api_key_id: this.apiKeys[provider]
      }));

      this.showLoader();

      if (this.selectedCompanyData?._id) {
        // Update existing company
        this._companyService.update(payload).subscribe({
          next: (response: any) => {
            this.hideLoader();
            this.showSuccessToast('Company updated successfully!');
            this.createdUpdatedCompany.emit();
          },
          error: (error: any) => {
            this.hideLoader();
            this.showErrorToast(error?.error?.message || 'Error updating company');
          }
        });
      } else {
        // Create new company
        this._companyService.create(payload).subscribe({
          next: (response: any) => {
            this.hideLoader();
            this.showSuccessToast('Company created successfully!');
            this.createdUpdatedCompany.emit();
          },
          error: (error: any) => {
            this.hideLoader();
            this.showErrorToast(error?.error?.message || 'Error creating company');
          }
        });
      }
    } else {
      if (!voiceProvidersValid) {
        this.showErrorToast('Please select at least one voice provider and provide all API keys');
      } else {
        this.showErrorToast('Please fill in all required fields');
      }
    }
  }

  getCountryListing() {
    this.showLoader();
    this._companyService.getCountryMasterList().subscribe({
      next: (response: any) => {
        this.hideLoader();

        if (response?.data?.countries && Array.isArray(response.data.countries)) {
          this.countries = response.data.countries.map((country: any) => ({
            _id: country._id,
            code: country.code,
            name: country.name,
            fullName: country.name
          }));
        }
      },
      error: (err) => {
        this.hideLoader();
        this.showErrorToast(`Error fetching countries: ${err.error?.message || err.message}`);
      }
    });
  }

  preventDecimal(event: any): void {
    const value = event.target.value;
    if (value && value.includes('.')) {
      event.target.value = value.replace(/\./g, '');
      const controlName = event.target.getAttribute('formControlName');
      if (controlName) {
        this.companyForm.get(controlName)?.setValue(parseInt(value.replace(/\./g, ''), 10) || null);
      }
    }
  }
}
