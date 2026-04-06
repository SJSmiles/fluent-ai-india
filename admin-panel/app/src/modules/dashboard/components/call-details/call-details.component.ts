import {
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChange,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef
} from '@angular/core';
import { AppComponent } from 'app/app.component';
import { FluentAdminAppComponent } from 'app/src/core/shared-component';
import { AuthService } from 'app/src/shared/services/auth/auth-service';
import { TimeFormatService } from 'app/src/shared/services/time-format.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'dashboard-call-details',
  templateUrl: './call-details.component.html',
  styleUrl: './call-details.component.scss'
})
export class DashboardCallDetailsComponent
  extends FluentAdminAppComponent
  implements OnInit, OnDestroy
{
  @Input() currentCallDetails: any;
  @Input() activeTab: any;

  @Output() public closeCallDetailsModal = new EventEmitter<any>();
  @ViewChild('audioPlayer') audioPlayerRef!: ElementRef<HTMLAudioElement>;

  // Current user
  currentUser: any;

  // Selected call attempt
  selectedAttemptIndex: number = 0;
  selectedAttempt: any = null;

  // Audio player
  isPlaying: boolean = false;
  currentTime: number = 0;
  duration: number = 0;
  playbackSpeed: number = 1;
  audioVolume: number = 1;

  private destroy$ = new Subject<void>();

  constructor(
    private appComponent: AppComponent,
    private authService: AuthService,
    private timeFormatService: TimeFormatService
  ) {
    super(appComponent);
  }

  ngOnInit(): void {
    // Get current user
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user: any) => {
      if (!user) return;
      this.currentUser = user;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
    if ('currentCallDetails' in changes) {
      this.currentCallDetails = changes['currentCallDetails'].currentValue;
      if (this.currentCallDetails?.calls && this.currentCallDetails.calls.length > 0) {
        this.selectAttempt(0);
      }
    }

    if ('activeTab' in changes) {
      this.activeTab = changes['activeTab'].currentValue;
    }
  }

  // Tab management
  switchTab(tab: 'overview' | 'transcript' | 'statusHistory'): void {
    this.activeTab = tab;
    console.log('🔄 Switched to tab:', tab);
  }

  // Attempt selection
  selectAttempt(index: number): void {
    if (!this.currentCallDetails?.calls || !this.currentCallDetails.calls[index]) return;

    this.selectedAttemptIndex = index;
    this.selectedAttempt = this.currentCallDetails.calls[index];
    this.resetAudioPlayer();

    console.log('🎯 Selected attempt:', index + 1, this.selectedAttempt);
  }

  // Audio player methods
  togglePlayPause(): void {
    const audio = this.audioPlayerRef?.nativeElement;
    if (!audio) return;

    if (this.isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    this.isPlaying = !this.isPlaying;
  }

  onAudioPlay(): void {
    this.isPlaying = true;
  }

  onAudioPause(): void {
    this.isPlaying = false;
  }

  onAudioTimeUpdate(event: Event): void {
    const audio = event.target as HTMLAudioElement;
    this.currentTime = audio.currentTime;
  }

  onAudioLoadedMetadata(event: Event): void {
  const audio = event.target as HTMLAudioElement;
  if (!isNaN(audio.duration) && isFinite(audio.duration)) {
    this.duration = audio.duration;
    console.log('✅ Audio duration loaded:', this.duration);
  }
}

  seekAudio(event: any): void {
    const audio = this.audioPlayerRef?.nativeElement;
    if (!audio) return;

    const value = parseFloat(event.target.value);
    audio.currentTime = value;
    this.currentTime = value;
  }

  changePlaybackSpeed(): void {
    const audio = this.audioPlayerRef?.nativeElement;
    if (!audio) return;

    const speeds = [1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(this.playbackSpeed);
    this.playbackSpeed = speeds[(currentIndex + 1) % speeds.length];
    audio.playbackRate = this.playbackSpeed;
  }

  onVolumeChange(event: Event): void {
    const audio = this.audioPlayerRef?.nativeElement;
    if (!audio) return;

    const target = event.target as HTMLInputElement;
    const volume = parseFloat(target.value);
    audio.volume = volume;
    this.audioVolume = volume;
  }

  downloadAudio(): void {
    console.log('📥 Download audio:', this.selectedAttempt?.recordingUrl);
    if (!this.selectedAttempt?.recordingUrl) {
      this.showErrorToast('No recording URL available');
      return;
    }

    this.downloadRecording(this.selectedAttempt.recordingUrl);
  }

  downloadTranscript(): void {
    console.log('📥 Download transcript');
    if (!this.selectedAttempt?.transcript || this.selectedAttempt.transcript.length === 0) {
      this.showErrorToast('No transcript available');
      return;
    }

    const content = this.getTranscriptContent();
    if (content) {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `call-transcript-attempt-${this.selectedAttemptIndex + 1}-${Date.now()}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      this.showSuccessToast('Transcript downloaded successfully');
    }
  }

  downloadRecording(url: string): void {
    if (!url) {
      this.showErrorToast('No recording URL available');
      return;
    }

    fetch(url, { mode: 'cors' })
      .then((response) => response.blob())
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `call-recording-attempt-${this.selectedAttemptIndex + 1}-${Date.now()}.wav`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
        this.showSuccessToast('Recording downloaded successfully');
      })
      .catch((err) => {
        console.error('Download failed:', err);
        this.showErrorToast('Failed to download recording');
      });
  }

  getTranscriptContent(): string {
    if (!this.selectedAttempt?.transcript) return '';

    return (
      this.selectedAttempt.transcript
        .map((record: any) => {
          const role = record?.role?.toUpperCase() || 'UNKNOWN';
          const content = record?.content || '';
          const timestamp = this.formatTranscriptTimestamp(record.timestamp);
          return `[${timestamp}] ${role}: ${content}`;
        })
        .join('\n\n') || ''
    );
  }

  resetAudioPlayer(): void {
  const audio = this.audioPlayerRef?.nativeElement;
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  this.isPlaying = false;
  this.currentTime = 0;
  this.duration = 0; // Don't parse from string, let audio metadata load it
  this.playbackSpeed = 1;
}

onAudioEnded(): void {
  this.isPlaying = false;
  this.currentTime = 0;
  console.log('🎵 Audio playback ended');
}

  // Helper methods
  parseDuration(duration: string): number {
    // Convert "0:48" to seconds
    const parts = duration.split(':');
    const minutes = parseInt(parts[0] || '0', 10);
    const seconds = parseInt(parts[1] || '0', 10);
    return minutes * 60 + seconds;
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatTranscriptTimestamp(timestamp: number): string {
    if (!timestamp || !this.selectedAttempt?.transcript?.[0]?.timestamp) return '00:00';

    const startTime = this.selectedAttempt.transcript[0].timestamp;
    const elapsedSeconds = Math.floor((timestamp - startTime) / 1000);

    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  getStatusChangeAuthor(change: any): string {
    if (!change.createdBy) return 'Unknown';

    if (change.createdBy._id === this.currentUser?.user?._id) {
      return 'You';
    }

    return change.createdBy.name || change.createdBy.email || 'Unknown';
  }

  formatStatusChangeDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  getAttemptIcon(attempt: any): string {
    if (attempt.status === 'ended' && attempt.duration !== '0:00') {
      return 'success'; // Green
    }
    return 'default'; // Gray
  }

  getAgentInitials(agentName: string): string {
    if (!agentName || agentName === 'Unknown Agent') {
      return 'UA';
    }

    // Replace hyphens with spaces and split into words
    const words = agentName.replace(/-/g, ' ').split(' ');

    // Filter out common suffixes
    const excludeWords = ['prod', 'dev', 'test', 'v1', 'v2', 'v3', 'v4', 'v5', 'copy'];
    const filteredWords = words.filter(
      (word) => word && !excludeWords.includes(word.toLowerCase())
    );

    // Get initials from first two words
    if (filteredWords.length >= 2) {
      return (filteredWords[0][0] + filteredWords[1][0]).toUpperCase();
    } else if (filteredWords.length === 1) {
      return filteredWords[0].substring(0, 2).toUpperCase();
    }

    return 'NA';
  }

  backToListing(): void {
    this.closeCallDetailsModal.emit();
  }
}
