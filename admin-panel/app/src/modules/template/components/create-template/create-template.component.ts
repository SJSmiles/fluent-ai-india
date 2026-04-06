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
import { TemplateService } from 'app/src/shared/services/api/template-service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-create-template',
  templateUrl: './create-template.component.html',
  styleUrl: './create-template.component.scss'
})
export class CreateTemplateComponent extends FluentAdminAppComponent implements OnDestroy, OnInit {
  @Input() selectedRecord: any = null;
  @Input() currentUser: any = null;
  @Output() createdUpdatedRecord = new EventEmitter<any>();

  @ViewChild('messageInput') messageInput!: ElementRef;

  private destroy$ = new Subject<void>();
  submitted = false;
  recordForm!: FormGroup;

  variables = [
    { label: 'Name', value: '{{name}}' },
    { label: 'Phone', value: '{{phone}}' },
    { label: 'Email', value: '{{email}}' },
    { label: 'Company', value: '{{company}}' }
  ];

  constructor(
    private appComponent: AppComponent,
    private _templateService: TemplateService,
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
      message: [
        this.selectedRecord?.message || null,
        [Validators.required, CustomValidators.requiredWithTrim]
      ],
      isActive: [this.selectedRecord?.isActive ?? true]
    });
  }

  insertVariable(variable: string) {
    const textarea = this.messageInput.nativeElement;
    const scrollPos = textarea.scrollTop;
    let strPos = 0;

    // Modern browsers
    if (textarea.selectionStart || textarea.selectionStart == '0') {
      strPos = textarea.selectionStart;
    } else {
      textarea.focus();
      strPos = textarea.value.length;
    }

    const front = (textarea.value).substring(0, strPos);
    const back = (textarea.value).substring(strPos, textarea.value.length);

    this.recordForm.patchValue({
      message: front + variable + back
    });

    textarea.selectionStart = strPos + variable.length;
    textarea.selectionEnd = strPos + variable.length;
    textarea.focus();
    textarea.scrollTop = scrollPos;
  }

  close() {
    this._modalService.dismissAll();
  }

  submit() {
    this.submitted = true;
    if (this.recordForm.valid) {
      const payload = this.recordForm.value;

      this.showLoader();

      // TODO: Use correct service method
      const request$ = this.selectedRecord?._id
        ? this._templateService.update(payload)
        : this._templateService.create(payload);

      request$.subscribe({
        next: (response: any) => {
          this.showSuccessToast(`Template ${this.selectedRecord ? 'updated' : 'created'} successfully!`);
          this.createdUpdatedRecord.emit();
        },
        error: (error: any) => {
          this.hideLoader();
          this.showErrorToast(error?.error?.message || 'Error saving template');
        }
      });
    }
  }
}
