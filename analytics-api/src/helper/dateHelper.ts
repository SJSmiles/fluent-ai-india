import dayjs from 'dayjs';


export const getComparisonRanges = (startDate: string, endDate: string) => {
  const start: any = dayjs(startDate);
  const end: any = dayjs(endDate);

  const diffDays = end.diff(start, 'day') + 1;

  return {
    currentRange: {
      start: new Date(start),
      end: new Date(end)
    },
    previousRange: {
      start: new Date(start.subtract(diffDays, 'day')),
      end: new Date(end.subtract(diffDays, 'day'))
    }
  };

};
