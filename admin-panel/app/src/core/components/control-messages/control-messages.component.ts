import { Component, Input } from '@angular/core';
import { UntypedFormControl } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { CustomValidators } from '../../lib/custom-validators';

@Component({
  selector: 'app-control-messages',
  template: `<div class="errorMessage" *ngIf="errorMessage !== null">{{ errorMessage }}</div>`
})
export class ControlMessagesComponent {
  @Input() public control: UntypedFormControl = new UntypedFormControl();

  constructor(private translateService: TranslateService) {}

  get errorMessage(): any {
    for (const propertyName in this.control?.errors) {
      if (this.control.errors.hasOwnProperty(propertyName)) {
        const translationKey = CustomValidators.getValidatorErrorMessage(
          propertyName,
          this.control.errors[propertyName]
        );

        // Check if the translationKey contains parameters (for maxlength, minlength, etc.)
        if (translationKey && translationKey.includes(',')) {
          const [key, param] = translationKey.split(',');
          return this.translateService.instant(key, { value: param });
        }

        return this.translateService.instant(translationKey);
      }
    }
    return null;
  }
}
