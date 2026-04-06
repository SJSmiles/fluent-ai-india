import {
  Component,
  Output,
  EventEmitter,
  Input,
  SimpleChange,
  ViewChild,
  ElementRef,
  OnChanges
} from '@angular/core';
import flatpickr from 'flatpickr';

@Component({
  selector: 'app-single-date-selector',
  templateUrl: './single-date-selector.component.html',
  styleUrls: ['./single-date-selector.component.scss']
})
export class SingleDateSelectorComponent implements OnChanges {
  @ViewChild('dateSelector') dateSelector: ElementRef | any;
  @Input() public defaultDate: any;
  @Input() public minDate: any;
  @Input() public maxDate: any;
  @Input() disabled: boolean = false;
  @Input() public format: any = 'Y-m-d H:i'; // Default format with time
  @Input() public calendarIcon: any;
  @Input() public enableTime: boolean = true; // Enable time by default
  @Input() public placeholder: string = 'Select Date';
  @Output() public selected = new EventEmitter<any>();

  constructor() {}

  ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
    if (this.dateSelector) {
      this.changeInDate();
    }
  }

  ngAfterViewInit() {
    this.changeInDate();
  }

  onDateSelected(event: any) {
    if (!this.disabled) {
      this.selected.emit(event);
    }
  }

  changeInDate() {
    if (this.dateSelector) {
      const flatpickrInstance = flatpickr(this.dateSelector.nativeElement, {
        dateFormat: this.enableTime ? this.format : 'Y-m-d',
        minDate: this.minDate || null,
        maxDate: this.maxDate || null,
        defaultDate: this.defaultDate || new Date(),
        mode: 'single',
        enableTime: this.enableTime,
        noCalendar: false,
        onChange: (selectedDates) => {
          this.selected.emit(selectedDates[0]);
        }
      });

      // Update flatpickr instance on changes
      if (this.defaultDate) {
        flatpickrInstance.setDate(this.defaultDate);
      }
    }
  }
}
