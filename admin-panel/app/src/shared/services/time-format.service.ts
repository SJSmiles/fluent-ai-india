import { Injectable } from '@angular/core';
import * as dayjs from 'dayjs';

@Injectable({ providedIn: 'root' })
export class TimeFormatService {
  setDate(date: Date, type: any): string {
    let formattedDate = dayjs(date);
    if (type === 'startDate') {
      formattedDate = formattedDate.startOf('day');
    } else if (type === 'endDate') {
      formattedDate = formattedDate.endOf('day');
    }
    return formattedDate.toISOString();
  }

  setTime(duration: any): string {
    if (duration == null) return '-';
    const totalSeconds = Math.floor(duration / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')} min`;
  }

  formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
