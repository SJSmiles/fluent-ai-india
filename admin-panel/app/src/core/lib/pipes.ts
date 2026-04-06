import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Pipe({ name: 'truncateText' })
export class TruncatePipe implements PipeTransform {
  public transform(value: string, limit = 25, completeWords = false, ellipsis = '..'): string {
    if (completeWords) {
      if (value !== undefined && value !== null && value.length > limit) {
        limit = value.substr(0, limit).lastIndexOf(' ');
      }
    }
    if (value !== undefined && value !== null && value.length > limit) {
      return `${value.substr(0, limit)}${ellipsis}`;
    } else {
      return value;
    }
  }
}

@Pipe({
  name: 'limitTo'
})
export class LimitToPipe implements PipeTransform {
  transform(value: any, limit: number): string {
    if (!value) return '';

    const stringValue = value.toString();
    return stringValue.length > limit ? stringValue.substring(0, limit) + '...' : stringValue;
  }
}

@Pipe({ name: 'htmlToPlaintext' })
export class HtmlToPlaintext implements PipeTransform {
  public transform(value: string): any {
    return value ? String(value).replace(/<[^>]+>/gm, '') : '';
  }
}

@Pipe({ name: 'toFixedNumber' })
export class ToFixedNumber implements PipeTransform {
  public transform(value: any, limit: 2): any {
    if (value !== null && value !== undefined) {
      return value.toFixed(limit);
    }
    return null;
  }
}

@Pipe({ name: 'convertDecimalToTime' })
export class ConvertDecimalToTime implements PipeTransform {
  public transform(value: any): any {
    if (value !== null && value !== undefined) {
      const hours = Math.floor(value);
      const remainingDecimal = value - hours;
      const minutes = Math.floor(remainingDecimal * 60);
      const seconds = Math.floor((remainingDecimal * 60 - minutes) * 60);
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return 0;
  }
}

@Pipe({
  name: 'join'
})
export class JoinPipe implements PipeTransform {
  transform(values: any[], delimiter: string = ', '): string {
    if (!values || !values.length) return '';
    return values.map((value) => value.customer || value.user || value.name).join(delimiter);
  }
}

@Pipe({
  name: 'customDateFormat'
})
export class CustomDateFormatPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return value;

    const date = new Date(value);

    // Extract year, month, date, time and milliseconds
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2); // Months are 0-indexed
    const day = ('0' + date.getDate()).slice(-2);
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
    const seconds = ('0' + date.getSeconds()).slice(-2);
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0');

    // Construct the formatted date
    return `${year}-${month}-${day} / ${hours}:${minutes}:${seconds}.${milliseconds}`;
  }
}

@Pipe({ name: 'arrayNumberToMonth' })
export class ArrayNumberToMonth implements PipeTransform {
  public transform(value: any): any {
    if (value !== null && value !== undefined && value.length > 0) {
      const yearList = [
        {
          key: 2023,
          display: '2023',
          checked: false,
          months: [
            { key: 1, display: 'January', checked: false },
            { key: 2, display: 'February', checked: false },
            { key: 3, display: 'March', checked: false },
            { key: 4, display: 'April', checked: false },
            { key: 5, display: 'May', checked: false },
            { key: 6, display: 'June', checked: false },
            { key: 7, display: 'July', checked: false },
            { key: 8, display: 'August', checked: false },
            { key: 9, display: 'September', checked: false },
            { key: 10, display: 'October', checked: false },
            { key: 11, display: 'November', checked: false },
            { key: 12, display: 'December', checked: false }
          ]
        },
        {
          key: 2024,
          display: '2024',
          checked: false,
          months: [
            { key: 1, display: 'January', checked: false },
            { key: 2, display: 'February', checked: false },
            { key: 3, display: 'March', checked: false },
            { key: 4, display: 'April', checked: false },
            { key: 5, display: 'May', checked: false },
            { key: 6, display: 'June', checked: false },
            { key: 7, display: 'July', checked: false },
            { key: 8, display: 'August', checked: false },
            { key: 9, display: 'September', checked: false },
            { key: 10, display: 'October', checked: false },
            { key: 11, display: 'November', checked: false },
            { key: 12, display: 'December', checked: false }
          ]
        },
        {
          key: 2025,
          display: '2025',
          checked: false,
          months: [
            { key: 1, display: 'January', checked: false },
            { key: 2, display: 'February', checked: false },
            { key: 3, display: 'March', checked: false },
            { key: 4, display: 'April', checked: false },
            { key: 5, display: 'May', checked: false },
            { key: 6, display: 'June', checked: false },
            { key: 7, display: 'July', checked: false },
            { key: 8, display: 'August', checked: false },
            { key: 9, display: 'September', checked: false },
            { key: 10, display: 'October', checked: false },
            { key: 11, display: 'November', checked: false },
            { key: 12, display: 'December', checked: false }
          ]
        },
        {
          key: 2026,
          display: '2026',
          checked: false,
          months: [
            { key: 1, display: 'January', checked: false },
            { key: 2, display: 'February', checked: false },
            { key: 3, display: 'March', checked: false },
            { key: 4, display: 'April', checked: false },
            { key: 5, display: 'May', checked: false },
            { key: 6, display: 'June', checked: false },
            { key: 7, display: 'July', checked: false },
            { key: 8, display: 'August', checked: false },
            { key: 9, display: 'September', checked: false },
            { key: 10, display: 'October', checked: false },
            { key: 11, display: 'November', checked: false },
            { key: 12, display: 'December', checked: false }
          ]
        },
        {
          key: 2027,
          display: '2027',
          checked: false,
          months: [
            { key: 1, display: 'January', checked: false },
            { key: 2, display: 'February', checked: false },
            { key: 3, display: 'March', checked: false },
            { key: 4, display: 'April', checked: false },
            { key: 5, display: 'May', checked: false },
            { key: 6, display: 'June', checked: false },
            { key: 7, display: 'July', checked: false },
            { key: 8, display: 'August', checked: false },
            { key: 9, display: 'September', checked: false },
            { key: 10, display: 'October', checked: false },
            { key: 11, display: 'November', checked: false },
            { key: 12, display: 'December', checked: false }
          ]
        },
        {
          key: 2028,
          display: '2028',
          checked: false,
          months: [
            { key: 1, display: 'January', checked: false },
            { key: 2, display: 'February', checked: false },
            { key: 3, display: 'March', checked: false },
            { key: 4, display: 'April', checked: false },
            { key: 5, display: 'May', checked: false },
            { key: 6, display: 'June', checked: false },
            { key: 7, display: 'July', checked: false },
            { key: 8, display: 'August', checked: false },
            { key: 9, display: 'September', checked: false },
            { key: 10, display: 'October', checked: false },
            { key: 11, display: 'November', checked: false },
            { key: 12, display: 'December', checked: false }
          ]
        },
        {
          key: 2029,
          display: '2029',
          checked: false,
          months: [
            { key: 1, display: 'January', checked: false },
            { key: 2, display: 'February', checked: false },
            { key: 3, display: 'March', checked: false },
            { key: 4, display: 'April', checked: false },
            { key: 5, display: 'May', checked: false },
            { key: 6, display: 'June', checked: false },
            { key: 7, display: 'July', checked: false },
            { key: 8, display: 'August', checked: false },
            { key: 9, display: 'September', checked: false },
            { key: 10, display: 'October', checked: false },
            { key: 11, display: 'November', checked: false },
            { key: 12, display: 'December', checked: false }
          ]
        },
        {
          key: 2030,
          display: '2030',
          checked: false,
          months: [
            { key: 1, display: 'January', checked: false },
            { key: 2, display: 'February', checked: false },
            { key: 3, display: 'March', checked: false },
            { key: 4, display: 'April', checked: false },
            { key: 5, display: 'May', checked: false },
            { key: 6, display: 'June', checked: false },
            { key: 7, display: 'July', checked: false },
            { key: 8, display: 'August', checked: false },
            { key: 9, display: 'September', checked: false },
            { key: 10, display: 'October', checked: false },
            { key: 11, display: 'November', checked: false },
            { key: 12, display: 'December', checked: false }
          ]
        }
      ];
      const matchingItems: { year: number; month: string }[] = [];

      value.forEach((budgetMonth: { year: number; months: any[] }) => {
        const yearItem = yearList.find((item) => item.key === budgetMonth.year);
        if (yearItem) {
          budgetMonth.months.forEach((monthKey) => {
            const monthItem = yearItem.months.find((month) => month.key === monthKey);
            if (monthItem) {
              matchingItems.push({ year: yearItem.key, month: monthItem.display });
            }
          });
        }
      });
      // Group months by year
      const groupedMonths = matchingItems.reduce((acc: any, curr: any) => {
        if (!acc[curr.year]) {
          acc[curr.year] = [];
        }
        acc[curr.year].push(curr.month);
        return acc;
      }, {});

      // Format the output string
      const formattedString = Object.keys(groupedMonths)
        .map((year) => {
          const months = groupedMonths[year].join(', ');
          return `${months} (${year})`;
        })
        .join(' | ');
      return formattedString;
    }
    return 'N/A';
  }
}

@Pipe({
  name: 'safeUrl'
})
export class SafeUrlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}
  transform(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}

@Pipe({
  name: 'capitalizeFirst'
})
export class CapitalizeFirstPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }
}

@Pipe({
  name: 'truncateStart'
})
export class TruncateStartPipe implements PipeTransform {
  transform(value: string, limit: number = 25, ellipsis: string = '...'): string {
    if (!value || value.length <= limit) {
      return value; // If the string is within the limit, return it as is.
    }

    const endLength = limit - ellipsis.length; // Calculate the visible part's length.
    if (endLength <= 0) {
      return value.substr(-limit); // If the limit is too small for ellipsis.
    }

    const endPart = value.substr(-endLength); // Extract the last part of the string.

    return `${ellipsis}${endPart}`; // Add ellipsis to the start.
  }
}

@Pipe({
  name: 'limitMid'
})
export class TruncateFileNamePipe implements PipeTransform {
  transform(fileName: string, maxLength: number = 15): string {
    if (!fileName || fileName.length <= maxLength) {
      return fileName;
    }

    const fileExtension = fileName.substring(fileName.lastIndexOf('.') + 1);
    const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
    const truncatedBase =
      baseName.length > maxLength
        ? baseName.substring(0, maxLength / 2) +
          '...' +
          baseName.substring(baseName.length - maxLength / 2)
        : baseName;

    return `${truncatedBase}.${fileExtension}`;
  }
}

@Pipe({
  name: 'splitOnCapital'
})
export class SplitOnCapitalPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return '';

    return value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

export const FILTERS = [
  TruncatePipe,
  HtmlToPlaintext,
  ToFixedNumber,
  ConvertDecimalToTime,
  ArrayNumberToMonth,
  JoinPipe,
  LimitToPipe,
  CustomDateFormatPipe,
  SafeUrlPipe,
  CapitalizeFirstPipe,
  TruncateStartPipe,
  TruncateFileNamePipe,
  SplitOnCapitalPipe
];
