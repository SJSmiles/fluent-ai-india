import {
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChange,
  TemplateRef,
  ViewChild
} from '@angular/core';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { AppComponent } from 'app/app.component';
import { CALL_STATUS } from 'app/src/config/constants/constants';
import { FluentAdminAppComponent } from 'app/src/core/shared-component';
import { CallService } from 'app/src/shared/services';
import { CallStatusService } from 'app/src/shared/services/call-status.service';
import { TimeFormatService } from 'app/src/shared/services/time-format.service';

@Component({
  selector: 'dashboard-details',
  templateUrl: './details.component.html',
  styleUrl: './details.component.scss'
})
export class DashboardDetailsComponent extends FluentAdminAppComponent {
  @Input() currentCallDetails: any;
  @Output() public backToDashboard = new EventEmitter<any>();
  @ViewChild('createBatchFromCallModal') createBatchFromCallModal!: TemplateRef<any>;
  activePanelIds: string[] = [];
  callStatus = CALL_STATUS;
  audioVolume: number = 1;
  isVolumeDropdownOpen = false;

  batchCallModalRef: NgbModalRef | null = null;

  // Data for batch call modal
  selectedCallIds: string[] = [];
  selectedCallsData: any[] = [];

  constructor(
    private appComponent: AppComponent,
    private _timeFormatService: TimeFormatService,
    private _callStatusService: CallStatusService,
    private _callService: CallService,
    private _modalService: NgbModal
  ) {
    super(appComponent);
  }

  public ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
    if ('currentCallDetails' in changes) {
      this.currentCallDetails = changes['currentCallDetails'].currentValue;
    }
  }

  onVolumeChange(event: Event, audioElement: HTMLAudioElement): void {
    const target = event.target as HTMLInputElement;
    const sliderValue = parseFloat(target.value);
    const actualVolume = 1 - sliderValue;
    audioElement.volume = actualVolume;
    this.audioVolume = actualVolume;
  }

  isPanelOpen(panelId: string): boolean {
    return this.activePanelIds.includes(panelId);
  }

  togglePanel(panelId: string): void {
    const index = this.activePanelIds.indexOf(panelId);
    if (index > -1) {
      this.activePanelIds.splice(index, 1); // Close panel
    } else {
      this.activePanelIds.push(panelId); // Open panel
    }
  }

  formatDuration(record: any) {
    return this._timeFormatService.setTime(record);
  }

  backToListing() {
    this.backToDashboard.emit();
  }

  getStatusConfig(status: number) {
    return this._callStatusService.getCallStatus(status, this.callStatus);
  }

  toggleDropdown(dropdownType: string) {
    this.isVolumeDropdownOpen = !this.isVolumeDropdownOpen;
  }

  copyContent(type: string): void {
    const content = this.getContent(type);
    if (content) {
      navigator.clipboard.writeText(content).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = content;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      });
    }
    this.showSuccessToast(
      `${type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()} copied sucessfully`
    );
  }

  downloadContent(type: string): void {
    const content = this.getContent(type);
    if (content) {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `call-${type}-${Date.now()}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    }
  }

  getContent(type: any) {
    if (type === 'summary') {
      return this.currentCallDetails?.callSummary || '';
    } else if (type === 'transcript') {
      return (
        this.currentCallDetails?.transcriptObject
          ?.map((record: any) => `${record?.role?.toUpperCase()}: ${record?.content}`)
          .join('\n\n') || ''
      );
    }
    return '';
  }

  directCall(callId?: string): void {
    if (!this.currentCallDetails) {
      this.showErrorToast('No call details available');
      return;
    }

    // Set the selected call data
    this.selectedCallIds = [this.currentCallDetails._id];
    this.selectedCallsData = [this.currentCallDetails];

    // Open the batch call modal
    this.batchCallModalRef = this._modalService.open(this.createBatchFromCallModal, {
      size: 'xl',
      backdrop: 'static',
      keyboard: false,
      centered: true,
      windowClass: 'custom-lead-modal'
    });
  }

  // Handle batch creation event
  batchCallCreateEvent(): void {
    this.selectedCallIds = [];
    this.selectedCallsData = [];
    if (this.batchCallModalRef) {
      this.batchCallModalRef.close();
    }
    // Optionally close the details offcanvas and refresh parent
    this.backToListing();
  }

  downloadRecording(url: any) {
    if (!url) return;

    fetch(url, { mode: 'cors' })
      .then((response) => response.blob())
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = 'recording.mp3'; // optional custom name
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
      })
      .catch((err) => console.error('Download failed:', err));
  }
}
