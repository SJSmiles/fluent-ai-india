import { AppComponent } from 'app/app.component';
import { Inject } from '@angular/core';
import { IndividualConfig } from 'ngx-toastr';

/**
 * This is a base class for all components that are defined in this application
 * The class provide the base functionality for performing common operation on
 * UI
 */
export abstract class FluentAdminAppComponent {
  /**
   *
   * @param mainAppComponent      An Instance of AppComponent class is required
   *                              for provisioning and performin the operations
   *                              in base UI.
   */
  constructor(@Inject(AppComponent) private mainAppComponent: AppComponent) {}

  /**
   * Shows loading bar
   */
  protected showLoader() {
    this.mainAppComponent._ngxSpinnerService.show();
  }

  /**
   * Hides loading bar.
   */
  protected hideLoader() {
    this.mainAppComponent._ngxSpinnerService.hide();
  }

  protected showErrorModal(message: any, title = 'Error') {
    if (Array.isArray(message)) {
      let messageString;
      for (const item of message) {
        messageString = messageString + '<li>' + item + '</li>';
      }
      messageString = '<ul>' + messageString + '</ul>';
      this.mainAppComponent.showErrorModal(messageString, title);
    } else {
      this.mainAppComponent.showErrorModal(message, title);
    }
  }
  protected showSuccessModal(message: any, title = 'Success') {
    this.mainAppComponent.showSuccessModal(message, title);
  }

  /**
   * ---------------------------------------------------------------------------
   * Shows a success toast to user
   * ---------------------------------------------------------------------------
   *
   * @param message       Message for toast
   * @param title         Title for toast windows. Default: 'Success'
   *
   */
  protected showSuccessToast(message: any, title = 'Success'): void {
    const toastOptions: Partial<IndividualConfig> = {
      timeOut: 3000
    };

    if (Array.isArray(message)) {
      let messageString = '';
      for (const item of message) {
        messageString = messageString + item + '<br>';
      }
      this.mainAppComponent._toastService.success(messageString, title, toastOptions);
    } else {
      this.mainAppComponent._toastService.success(message, title, toastOptions);
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Shows a error toast to user
   * ---------------------------------------------------------------------------
   *
   * @param message       Message for toast
   * @param title         Title for toast windows. Default: 'Error'
   *
   */
  protected showErrorToast(message: any, title = 'Error'): void {
    const toastOptions: Partial<IndividualConfig> = {
      timeOut: 3000
    };

    if (Array.isArray(message)) {
      let messageString = '';
      for (const item of message) {
        messageString = messageString + item + '<br>';
      }
      this.mainAppComponent._toastService.error(messageString, title, toastOptions);
    } else {
      this.mainAppComponent._toastService.error(message, title, toastOptions);
    }
  }

  /**
   * ---------------------------------------------------------------------------
   * Shows a warning toast to user
   * ---------------------------------------------------------------------------
   *
   * @param message       Message for toast
   * @param title         Title for toast windows. Default: 'Error'
   *
   */
  protected showWarningToast(message: any, title = 'Warning'): void {
    const toastOptions: Partial<IndividualConfig> = {
      timeOut: 3000
    };

    if (Array.isArray(message)) {
      let messageString = '';
      for (const item of message) {
        messageString = messageString + item + '<br>';
      }
      this.mainAppComponent._toastService.warning(messageString, title, toastOptions);
    } else {
      this.mainAppComponent._toastService.warning(message, title, toastOptions);
    }
  }
}
