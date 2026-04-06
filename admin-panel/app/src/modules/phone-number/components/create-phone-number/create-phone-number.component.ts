import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  SimpleChange,
  ViewChild
} from '@angular/core';
import { AppComponent } from 'app/app.component';
import { FluentAdminAppComponent } from 'app/src/core/shared-component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CustomValidators } from 'app/src/core/lib/custom-validators';
import { PhoneNumberService } from 'app/src/shared/services/api/phone-number.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-create-phone-number',
  templateUrl: './create-phone-number.component.html',
  styleUrl: './create-phone-number.component.scss'
})
export class CreatePhoneNumberComponent extends FluentAdminAppComponent implements OnDestroy, OnInit {
  @Input() selectedRecord: any = null;
  @Input() currentUser: any = null;
  @Input() companyId: string | null = null;
  @Output() createdUpdatedRecord = new EventEmitter<any>();

  private destroy$ = new Subject<void>();
  submitted = false;
  recordForm!: FormGroup;

  constructor(
    private appComponent: AppComponent,
    private _phoneNumberService: PhoneNumberService,
    private _modalService: NgbModal,
    private _formBuilder: FormBuilder
  ) {
    super(appComponent);
  }

  ngOnInit(): void {
    this.setValueInform();
  }

  public ngOnChanges(changes: { [propKey: string]: SimpleChange }): void {
    if ('selectedRecord' in changes) {
      this.selectedRecord = changes['selectedRecord'].currentValue;
      this.setValueInform();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setValueInform() {
    this.recordForm = this._formBuilder.group({
      _id: [this.selectedRecord ? this.selectedRecord?._id : null],
      name: [
        this.selectedRecord?.name || null,
        [Validators.required, CustomValidators.requiredWithTrim, Validators.maxLength(100)]
      ],
      phoneNumber: [
        this.selectedRecord?.phoneNumber || null,
        [Validators.required, CustomValidators.requiredWithTrim]
      ],
      phoneNumberId: [
        this.selectedRecord?.phoneNumberId || null,
        [Validators.required, CustomValidators.requiredWithTrim]
      ]
    });
  }

  close() {
    this._modalService.dismissAll();
  }

  submit() {
    this.submitted = true;
    if (this.recordForm.valid) {
      const payload = { ...this.recordForm.value };

      if (this.companyId && !this.selectedRecord?._id) {
        payload.companyId = this.companyId;
      }

      this.showLoader();

      const request$ = this.selectedRecord?._id
        ? this._phoneNumberService.update(payload)
        : this._phoneNumberService.create(payload);

      request$.subscribe({
        next: (response: any) => {
          this.showSuccessToast(`Phone Number ${this.selectedRecord ? 'updated' : 'created'} successfully!`);
          this.createdUpdatedRecord.emit();
        },
        error: (error: any) => {
          this.hideLoader();
          this.showErrorToast(error?.error?.message || 'Error saving phone number');
        }
      });
    }
  }
}
