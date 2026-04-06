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
  selector: 'dashboard-analytics-new',
  templateUrl: './analytics-new.component.html',
  styleUrl: './analytics-new.component.scss'
})
export class AnalyticsNewComponent extends FluentAdminAppComponent {
  callDuration: any;
  costPerCall: any;
  successfulCalls: any;
  failedCalls: any;
  pickupCalls: any;
  notPickupCalls: any;
  totalCalls: any;
  totalAttempts: any;
  totalAnswered: any;
  totalNoAnswered: any;
  totalAvgDuration: any;
  totalSuccess: any;
  totalGroupCall: any;
  statusCounts: StatusCount[] = [];
  isAnalyticsCollapsed = false;
  params: any;

  @Input() AnalyticsStartDate: any;
  @Input() AnalyticsEndDate: any;
  @Input() AnalyticsUserId: any;
  @Input() AnalyticsAgentId: any;
  @Input() leadDistributionChanged: any;
  @Input() bmbyEnabled: boolean = false;
  

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

    if ('leadDistributionChanged' in changes) {
      this.leadDistributionChanged = changes['leadDistributionChanged'].currentValue;
    }

    if (this.AnalyticsStartDate && this.AnalyticsEndDate && this.AnalyticsUserId) {
      if(this.leadDistributionChanged !== 'case13'){
        this.getTotalCallsCount();
      this.getTotalAttemptsCount();
      this.getTotalAnsweredCount();
      this.getTotalNoAnsweredCount();
      this.getTotalAvgDuratCount();
      this.getTotalSuccessCount();
      this.getLeadStatusGroupCount();
      }
    }

    if(this.leadDistributionChanged === 'case13'){
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
          this.totalAnswered = response?.data;
          console.log(this.totalAnswered);
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
          this.totalNoAnswered = response?.data;
          console.log(this.totalNoAnswered);
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
          this.totalAvgDuration = response?.data;
          console.log(this.totalAvgDuration);
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
          this.totalSuccess = response?.data;
          console.log(this.totalSuccess);
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
          this.totalGroupCall = response?.data;
          console.log(this.totalAttempts);
        }
      },
      (error) => {
        this.showErrorToast(`Error in Total Calls fetching ${error?.error?.error}`);
        this.hideLoader();
      }
    );
  }

  comparedValueNumber(value: any): number {
    return parseFloat(value || '0');
  }

  getCountByName(name: string): number {
    if (this.totalGroupCall && this.totalGroupCall.length > 0) {
      const found = this.totalGroupCall.find((item: { name: string }) => item.name === name);
      return found ? found.count : 0;
    }
    return 0;
  }

  getPercentageByName(name: string): number {
    if (this.totalGroupCall && this.totalGroupCall.length > 0) {
      const found = this.totalGroupCall.find((item: { name: string }) => item.name === name);
      return found ? found.percentage : 0;
    }
    return 0;
  }

  get comparisonText(): string {
    if (!this.AnalyticsStartDate || !this.AnalyticsEndDate) {
      return 'vs previous period';
    }

    const start = new Date(this.AnalyticsStartDate);
    const end = new Date(this.AnalyticsEndDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0 || diffDays === 1) {
      return 'vs yesterday';
    } else if (diffDays === 7) {
      return 'vs last 7 days';
    } else if (diffDays >= 28 && diffDays <= 31) {
      return 'vs last month';
    } else {
      return `vs last ${diffDays} days`;
    }
  }
}
