import { Component, Input, OnInit, SimpleChange } from '@angular/core';
import { AppComponent } from 'app/app.component';
import { FluentAdminAppComponent } from 'app/src/core/shared-component';
import { AnalyticsCallService } from 'app/src/shared/services/api/analytics-call.service';
import { ToastrService } from 'ngx-toastr';

interface StatusCount {
  name: string;
  count: number;
  change: number;
}

@Component({
  selector: 'dashboard-analytics',
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss'
})
export class AnalyticsComponent extends FluentAdminAppComponent {
  callDuration: any;
  costPerCall: any;
  successfulCalls: any;
  failedCalls: any;
  pickupCalls: any;
  notPickupCalls: any;
  totalCalls: any;
  totalAttempts: any;
  statusCounts: StatusCount[] = [];
  isAnalyticsCollapsed = false;
  params: any;

  @Input() AnalyticsStartDate: any;
  @Input() AnalyticsEndDate: any;
  @Input() AnalyticsUserId: any;
  @Input() AnalyticsAgentId: any;

  constructor(
    private analyticsService: AnalyticsCallService,
    private toastrService: ToastrService,
    private appComponent: AppComponent
  ) {
    super(appComponent);
  }

  toggleAnalytics() {
    this.isAnalyticsCollapsed = !this.isAnalyticsCollapsed;
  }

  public ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
    if ('AnalyticsStartDate' in changes) {
      this.AnalyticsStartDate = changes['AnalyticsStartDate'].currentValue;
    }

    if ('AnalyticsEndDate' in changes) {
      this.AnalyticsEndDate = changes['AnalyticsEndDate'].currentValue;
    }

    if ('AnalyticsUserId' in changes) {
      this.AnalyticsUserId = changes['AnalyticsUserId'].currentValue;
    }

    if ('AnalyticsAgentId' in changes) {
      this.AnalyticsAgentId = changes['AnalyticsAgentId'].currentValue;
    }

    if (this.AnalyticsStartDate && this.AnalyticsEndDate && this.AnalyticsUserId) {
      this.getTotalCallsCount();
      this.getCallDurationCount();
      this.getFailedCallsCount();
      this.getStatusCount();
      this.getTotalAttemptsCount();
      this.getTotalAnsweredCount();
      this.getTotalNoAnsweredCount();
      this.getTotalAvgDuratCount();
      this.getTotalSuccessCount();
      this.getLeadStatusGroupCount();
    }
  }

  getTotalCallsCount() {
    if (!this.AnalyticsStartDate || !this.AnalyticsEndDate) {
      return;
    }
    this.params = {
      startDate: this.AnalyticsStartDate,
      endDate: this.AnalyticsEndDate,
      type: 1,
      userId: this.AnalyticsUserId
    };
    if (this.AnalyticsAgentId != undefined) {
      this.params.agentId = this.AnalyticsAgentId;
    }
    this.analyticsService.getAnalyticsCount(this.params).subscribe(
      (response: any) => {
        if (response) {
          this.totalCalls = response?.data;
          console.log(this.totalCalls);
        }
      },
      (error) => {
        this.showErrorToast(`Error in Total Calls fetching ${error?.error?.error}`);
        this.hideLoader();
      }
    );
  }

  getTotalAttemptsCount() {
    if (!this.AnalyticsStartDate || !this.AnalyticsEndDate) {
      return;
    }
    this.params = {
      startDate: this.AnalyticsStartDate,
      endDate: this.AnalyticsEndDate,
      type: 8,
      userId: this.AnalyticsUserId
    };
    if (this.AnalyticsAgentId != undefined) {
      this.params.agentId = this.AnalyticsAgentId;
    }
    this.analyticsService.getAnalyticsCount(this.params).subscribe(
      (response: any) => {
        if (response) {
          this.totalAttempts = response?.data;
          console.log(this.totalAttempts);
        }
      },
      (error) => {
        this.showErrorToast(`Error in Total Calls fetching ${error?.error?.error}`);
        this.hideLoader();
      }
    );
  }

  getTotalAnsweredCount() {
    if (!this.AnalyticsStartDate || !this.AnalyticsEndDate) {
      return;
    }
    this.params = {
      startDate: this.AnalyticsStartDate,
      endDate: this.AnalyticsEndDate,
      type: 9,
      userId: this.AnalyticsUserId
    };
    if (this.AnalyticsAgentId != undefined) {
      this.params.agentId = this.AnalyticsAgentId;
    }
    this.analyticsService.getAnalyticsCount(this.params).subscribe(
      (response: any) => {
        if (response) {
          this.totalAttempts = response?.data;
          console.log(this.totalAttempts);
        }
      },
      (error) => {
        this.showErrorToast(`Error in Total Calls fetching ${error?.error?.error}`);
        this.hideLoader();
      }
    );
  }

  getTotalNoAnsweredCount() {
    if (!this.AnalyticsStartDate || !this.AnalyticsEndDate) {
      return;
    }
    this.params = {
      startDate: this.AnalyticsStartDate,
      endDate: this.AnalyticsEndDate,
      type: 10,
      userId: this.AnalyticsUserId
    };
    if (this.AnalyticsAgentId != undefined) {
      this.params.agentId = this.AnalyticsAgentId;
    }
    this.analyticsService.getAnalyticsCount(this.params).subscribe(
      (response: any) => {
        if (response) {
          this.totalAttempts = response?.data;
          console.log(this.totalAttempts);
        }
      },
      (error) => {
        this.showErrorToast(`Error in Total Calls fetching ${error?.error?.error}`);
        this.hideLoader();
      }
    );
  }

  getTotalAvgDuratCount() {
    if (!this.AnalyticsStartDate || !this.AnalyticsEndDate) {
      return;
    }
    this.params = {
      startDate: this.AnalyticsStartDate,
      endDate: this.AnalyticsEndDate,
      type: 11,
      userId: this.AnalyticsUserId
    };
    if (this.AnalyticsAgentId != undefined) {
      this.params.agentId = this.AnalyticsAgentId;
    }
    this.analyticsService.getAnalyticsCount(this.params).subscribe(
      (response: any) => {
        if (response) {
          this.totalAttempts = response?.data;
          console.log(this.totalAttempts);
        }
      },
      (error) => {
        this.showErrorToast(`Error in Total Calls fetching ${error?.error?.error}`);
        this.hideLoader();
      }
    );
  }

  getTotalSuccessCount() {
    if (!this.AnalyticsStartDate || !this.AnalyticsEndDate) {
      return;
    }
    this.params = {
      startDate: this.AnalyticsStartDate,
      endDate: this.AnalyticsEndDate,
      type: 12,
      userId: this.AnalyticsUserId
    };
    if (this.AnalyticsAgentId != undefined) {
      this.params.agentId = this.AnalyticsAgentId;
    }
    this.analyticsService.getAnalyticsCount(this.params).subscribe(
      (response: any) => {
        if (response) {
          this.totalAttempts = response?.data;
          console.log(this.totalAttempts);
        }
      },
      (error) => {
        this.showErrorToast(`Error in Total Calls fetching ${error?.error?.error}`);
        this.hideLoader();
      }
    );
  }

  getLeadStatusGroupCount() {
    if (!this.AnalyticsStartDate || !this.AnalyticsEndDate) {
      return;
    }
    this.params = {
      startDate: this.AnalyticsStartDate,
      endDate: this.AnalyticsEndDate,
      type: 13,
      userId: this.AnalyticsUserId
    };
    if (this.AnalyticsAgentId != undefined) {
      this.params.agentId = this.AnalyticsAgentId;
    }
    this.analyticsService.getAnalyticsCount(this.params).subscribe(
      (response: any) => {
        if (response) {
          this.totalAttempts = response?.data;
          console.log(this.totalAttempts);
        }
      },
      (error) => {
        this.showErrorToast(`Error in Total Calls fetching ${error?.error?.error}`);
        this.hideLoader();
      }
    );
  }

  getCallDurationCount() {
    if (!this.AnalyticsStartDate || !this.AnalyticsEndDate) return;
    this.params = {
      startDate: this.AnalyticsStartDate,
      endDate: this.AnalyticsEndDate,
      type: 2,
      userId: this.AnalyticsUserId
    };
    if (this.AnalyticsAgentId != undefined) {
      this.params.agentId = this.AnalyticsAgentId;
    }

    this.analyticsService.getAnalyticsCount(this.params).subscribe(
      (response: any) => {
        if (response) {
          this.callDuration = response?.data;
        }
      },
      (error) => {
        this.showErrorToast(`Error in Call Duration fetching: ${error?.error?.error}`);
        this.hideLoader();
      }
    );
  }

  getStatusCount() {
    if (!this.AnalyticsStartDate || !this.AnalyticsEndDate) return;

    this.params = {
      startDate: this.AnalyticsStartDate,
      endDate: this.AnalyticsEndDate,
      type: 6,
      userId: this.AnalyticsUserId
    };
    if (this.AnalyticsAgentId != undefined) {
      this.params.agentId = this.AnalyticsAgentId;
    }

    this.analyticsService.getAnalyticsCount(this.params).subscribe(
      (response: any) => {
        if (response && response.data && Array.isArray(response.data)) {
          // Create a new array reference to trigger change detection
          this.statusCounts = [...response.data];
        }
      },
      (error) => {
        this.showErrorToast(`Error in Status Count fetching: ${error?.error?.error}`);
        this.hideLoader();
      }
    );
  }

  getFailedCallsCount() {
    if (!this.AnalyticsStartDate || !this.AnalyticsEndDate) return;

    this.params = {
      startDate: this.AnalyticsStartDate,
      endDate: this.AnalyticsEndDate,
      type: 7,
      userId: this.AnalyticsUserId
    };
    if (this.AnalyticsAgentId != undefined) {
      this.params.agentId = this.AnalyticsAgentId;
    }

    this.analyticsService.getAnalyticsCount(this.params).subscribe(
      (response: any) => {
        if (response) {
          const data = response?.data;
          this.pickupCalls = data.find((item: any) => item.name === 'pickupCalls')?.count || 0;
          this.notPickupCalls =
            data.find((item: any) => item.name === 'notPickupCalls')?.count || 0;
          this.failedCalls = data.find((item: any) => item.name === 'failedCalls')?.count || 0;
        }
      },
      (error) => {
        this.showErrorToast(`Error in Failed Calls fetching: ${error?.error?.error}`);
        this.hideLoader();
      }
    );
  }
}
