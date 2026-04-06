import {
  ElementRef,
  ViewChild,
  Component,
  AfterViewInit,
  Output,
  EventEmitter,
  Input,
  SimpleChange
} from '@angular/core';
import flatpickr from 'flatpickr';
@Component({
  selector: 'app-date-selector',
  templateUrl: './date-selector.component.html',
  styleUrls: ['./date-selector.component.scss']
})
export class DateSelectorComponent implements AfterViewInit {
  @ViewChild('dateSelector') dateSelector: ElementRef | any;
  @Input() public defaultDate: any;
  @Input() public minDate: any;
  @Input() public maxDate: any;
  @Input() public format: any;
  @Output() public selected = new EventEmitter<any>();
  selectedDates: any;
  constructor() {}

  public ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
    if ('defaultDate' in changes) {
      if (
        changes['defaultDate'].currentValue !== undefined &&
        changes['defaultDate'].currentValue !== null
      ) {
        this.defaultDate = changes['defaultDate'].currentValue;
        if (this.dateSelector) {
          this.ngAfterViewInit();
        }
      }
    }
    if ('minDate' in changes) {
      if (
        changes['minDate'].currentValue !== undefined &&
        changes['minDate'].currentValue !== null
      ) {
        this.minDate = changes['minDate'].currentValue;

        if (this.dateSelector) {
          this.ngAfterViewInit();
        }
      }
    }
    if ('maxDate' in changes) {
      if (
        changes['maxDate'].currentValue !== undefined &&
        changes['maxDate'].currentValue !== null
      ) {
        this.maxDate = changes['maxDate'].currentValue;
        if (this.dateSelector) {
          this.ngAfterViewInit();
        }
      }
    }
  }

  ngAfterViewInit() {
    this.selectedDates = flatpickr(this.dateSelector.nativeElement, {
      dateFormat: this.format,
      minDate: this.minDate || null,
      maxDate: this.maxDate || null,
      defaultDate: this.defaultDate,
      mode: 'single',
      onChange: function (selectedDates) {
        return selectedDates;
      }
    });
  }

  onDateSelect() {
    this.selected.emit(this.selectedDates.selectedDates);
    this.ngAfterViewInit();
  }
}
