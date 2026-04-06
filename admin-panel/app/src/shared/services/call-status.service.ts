import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CallStatusService {
  getCallStatus(status: any, callStatus: any) {
    switch (status) {
      case callStatus.ONGOING:
        return {
          label: 'Running Call',
          iconType: 'running',
          class: 'running-call'
        };
      case callStatus.ENDED:
        return {
          label: 'Ended Call',
          iconType: 'ended',
          class: 'ended-call'
        };
      case callStatus.FAILED:
        return {
          label: 'Failed Call',
          iconType: 'failed',
          class: 'failed-call'
        };
      case callStatus.PENDING:
        return {
          label: 'Pending Call',
          iconType: 'pending',
          class: 'pending-call'
        };
      case callStatus.ERROR:
        return {
          label: 'Error Call',
          iconType: 'failed',
          class: 'failed-call'
        };
      default:
        return {
          label: 'Pending',
          iconType: 'pending',
          class: 'pending-call'
        };
    }
  }

  getRecordStatusConfig(record: any) {
    const status = record?.status;

    switch (status) {
      case 9:
        if (record?.schedule) {
          return {
            label: `Schedule: ${record.utcDateTime}`,
            iconType: 'schedule',
            class: '',
            showStartCalling: false,
            hasCustomStyling: false
          };
        } else {
          return {
            label: 'Queued',
            iconType: 'queued',
            class: '',
            showStartCalling: false,
            hasCustomStyling: true,
            customStyle: 'color: var(--primary-pending-status-color)'
          };
        }
      case 1: // Draft
        return {
          label: 'Draft',
          iconType: 'pencil',
          class: '',
          showStartCalling: true,
          hasCustomStyling: false
        };

      case 2:
      case 3:
        if (record?.schedule) {
          return {
            label: `Schedule: ${record.utcDateTime}`,
            iconType: 'schedule',
            class: '',
            showStartCalling: false,
            hasCustomStyling: false
          };
        } else {
          return {
            label: 'Running',
            iconType: 'running',
            class: '',
            showStartCalling: false,
            hasCustomStyling: true,
            customStyle: 'color: var(--primary-running-status-color)'
          };
        }

      case 4:
        return {
          label: 'Running',
          iconType: 'running',
          class: '',
          showStartCalling: false,
          hasCustomStyling: true,
          customStyle: 'color: var(--primary-running-status-color)'
        };

      case 5:
        return {
          label: 'Ended',
          iconType: 'completed-status',
          class: '',
          showStartCalling: false,
          hasCustomStyling: true,
          customStyle: 'color: var(--primary-success-color)'
        };

      case 6:
        return {
          label: 'Failed',
          iconType: 'failed',
          class: 'failed-call',
          showStartCalling: false,
          hasCustomStyling: false
        };
      case 7:
        return {
          label: 'Skipped',
          iconType: 'failed',
          class: 'failed-call',
          showStartCalling: false,
          hasCustomStyling: false
        };

      default:
        return {
          label: '-',
          iconType: '',
          class: 'text-muted',
          showStartCalling: false,
          hasCustomStyling: false
        };
    }
  }

  getFollowUpStatusConfig(record: any) {
    const status = record?.status;

    switch (status) {
      case 9:
        return {
          label: 'Pending',
          iconType: 'pending',
          class: '',
          showStartCalling: false,
          hasCustomStyling: true,
          customStyle: 'color: var(--primary-pending-status-color)'
        };
      case 1:
      case 2:
      case 3:
        return {
          label: `Schedule: ${record.utcDateTime}`,
          iconType: 'schedule',
          class: '',
          showStartCalling: false,
          hasCustomStyling: false
        };
      case 4:
        return {
          label: 'Running',
          iconType: 'running',
          class: '',
          showStartCalling: false,
          hasCustomStyling: true,
          customStyle: 'color: var(--primary-running-status-color)'
        };

      case 5:
        return {
          label: 'Ended',
          iconType: 'completed-status',
          class: '',
          showStartCalling: false,
          hasCustomStyling: true,
          customStyle: 'color: var(--primary-success-color)'
        };

      case 6:
        return {
          label: 'Failed',
          iconType: 'failed',
          class: 'failed-call',
          showStartCalling: false,
          hasCustomStyling: false
        };

      default:
        return {
          label: '-',
          iconType: '',
          class: 'text-muted',
          showStartCalling: false,
          hasCustomStyling: false
        };
    }
  }
}
