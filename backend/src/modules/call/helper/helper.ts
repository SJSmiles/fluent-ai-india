import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { CALL_STATUS } from '../../../config/server-config';
import { ITranscriptMessage } from '../interface/call.interface';

dayjs.extend(utc);
dayjs.extend(timezone);

export const mapStringStatusToNumber = (stringStatus: string): number | null => {
  const statusMap: { [key: string]: number } = {
    ongoing: CALL_STATUS.ONGOING,
    ended: CALL_STATUS.ENDED,
    failed: CALL_STATUS.FAILED,
    error: CALL_STATUS.FAILED,
    pending: CALL_STATUS.PENDING
  };
  return statusMap[stringStatus.toLowerCase()] || null;
};

export const mapNumberStatusToString = (numericStatus: number): string | null => {
  const statusMap: { [key: number]: string } = {
    [CALL_STATUS.ONGOING]: 'ongoing',
    [CALL_STATUS.ENDED]: 'ended',
    [CALL_STATUS.FAILED]: 'failed',
    [CALL_STATUS.PENDING]: 'pending'
  };
  return statusMap[numericStatus] || null;
};

export const getDateRange = (
  startDate?: string,
  endDate?: string
): { start: Date; end: Date } | null => {
  if (!startDate || !endDate) return null;
  try {
    return {
      start: dayjs(startDate).startOf('day').toDate(),
      end: dayjs(endDate).endOf('day').toDate()
    };
  } catch (error) {
    console.log('Error parsing date range:', error);
    return null;
  }
};

export const filterCallsByDate = (calls: any[], startDate?: string, endDate?: string): any[] => {
  if (!startDate || !endDate || !calls?.length) return calls || [];
  const dateRange = getDateRange(startDate, endDate);
  if (!dateRange) return calls;

  return calls.filter((call) => {
    const callTimestamp = call.start_timestamp || call.timestamp;
    if (!callTimestamp) return false;
    return callTimestamp >= dateRange.start.getTime() && callTimestamp <= dateRange.end.getTime();
  });
};

export const extractFirstNSentences = (
  transcript: ITranscriptMessage[],
  n: number = 2
): ITranscriptMessage[] => {
  if (!transcript || transcript.length === 0) return [];

  const result: ITranscriptMessage[] = [];
  let sentenceCount = 0;

  for (const message of transcript) {
    if (sentenceCount >= n) break;

    const content = message.content || '';
    
    // Split content by sentence delimiters
    const sentences = content
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 0);

    if (sentences.length === 0) continue;

    const remainingSentences = n - sentenceCount;
    const sentencesToTake = Math.min(sentences.length, remainingSentences);
    
    const extractedContent = sentences.slice(0, sentencesToTake).join(' ');
    
    result.push({
      ...message,
      content: extractedContent
    });

    sentenceCount += sentencesToTake;

    if (sentenceCount >= n) break;
  }

  return result;
};

