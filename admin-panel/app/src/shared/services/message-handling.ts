import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { IndividualConfig } from 'ngx-toastr';
import { ToastrService } from 'ngx-toastr';
import { NgxSpinnerService } from 'ngx-spinner';

@Injectable({
  providedIn: 'root'
})
export class MessageHandlerService {
  constructor(
    public _ngxSpinnerService: NgxSpinnerService,
    private translateService: TranslateService,
    private toastrService: ToastrService
  ) {}

  handleApiError(err: any, moduleName: string): void {
    const moduleNameTranslated = this.translateService.instant(moduleName);
    let errorCode = 'UNKNOWN_ERROR';
    if (err?.error?.code) {
      errorCode = err.error.code;
    } else if (err?.code) {
      errorCode = err.code;
    } else if (typeof err?.error === 'string') {
      try {
        const parsedError = JSON.parse(err.error);
        errorCode = parsedError.code || 'UNKNOWN_ERROR';
      } catch (e) {
        // Could not parse error as JSON
      }
    }

    const errorKey = `ERROR.${errorCode}`;
    this.translateService.get(errorKey).subscribe((translation) => {
      this.showErrorToast(translation, { moduleName: moduleNameTranslated });
    });
  }

  showErrorToast(messageKey: any, params: any = {}, titleKey: string = 'ERROR.TITLE'): void {
    const toastOptions: Partial<IndividualConfig> = {
      timeOut: 5000
    };
    const title = this.translateService.instant(titleKey);
    if (typeof messageKey === 'string' && messageKey.includes('{{')) {
      const moduleNameTranslated = params.moduleName;
      const message = messageKey.replace(/\{\{moduleName\}\}/g, moduleNameTranslated);
      this.toastrService.error(message, title, toastOptions);
    } else {
      const message = this.translateService.instant(messageKey, params);
      this.toastrService.error(message, title, toastOptions);
    }
  }

  showSuccessToast(messageKey: any, moduleName: string, titleKey: string = 'SUCCESS.TITLE'): void {
    const toastOptions: Partial<IndividualConfig> = {
      timeOut: 5000
    };
    const title = this.translateService.instant(titleKey);
    const moduleNameTranslated = this.translateService.instant(moduleName);
    const message = this.translateService.instant(messageKey, { moduleName: moduleNameTranslated });
    this.toastrService.success(message, title, toastOptions);
  }

  showCompanyWithManagersSuccess(managerCount: number): void {
    const toastOptions: Partial<IndividualConfig> = {
      timeOut: 5000
    };

    const title = this.translateService.instant('SUCCESS.TITLE');
    const companyName = this.translateService.instant('MODULES.COMPANY');

    // Get the appropriate manager message based on count
    let managerMessageKey = '';
    if (managerCount === 1) {
      managerMessageKey = 'SUCCESS.MANAGER_CREATE_SINGLE';
    } else {
      managerMessageKey = 'SUCCESS.MANAGER_CREATE_MULTIPLE';
    }

    const managerMessage = this.translateService.instant(managerMessageKey, {
      count: managerCount,
      moduleName: this.translateService.instant('MODULES.MANAGER')
    });

    // Create combined message
    const combinedMessage = this.translateService.instant('SUCCESS.COMPANY_AND_MANAGERS', {
      companyName: companyName,
      managerMessage: managerMessage
    });

    this.toastrService.success(combinedMessage, title, toastOptions);
  }

  showLoader() {
    this._ngxSpinnerService.show();
  }

  hideLoader() {
    this._ngxSpinnerService.hide();
  }

  showErrorMessage(message: any, title = 'Error'): void {
    const toastOptions: Partial<IndividualConfig> = {
      timeOut: 3000
    };

    if (Array.isArray(message)) {
      let messageString = '';
      for (const item of message) {
        messageString = messageString + item + '<br>';
      }
      this.toastrService.error(messageString, title, toastOptions);
    } else {
      this.toastrService.error(message, title, toastOptions);
    }
  }
}
