import { test, expect } from '@playwright/test';
import {
  extractCallLogId,
  findRecordingForCall,
} from '../../utils/doocti_call_contract';

test.describe('Doocti call API contract helpers', () => {
  test('extracts a numeric call log ID from the initiation response', () => {
    expect(extractCallLogId({ data: { call_log_id: '42' } })).toBe(42);
    expect(extractCallLogId({ data: {} })).toBeNull();
  });

  test('finds only the recording belonging to the initiated call', () => {
    const response = {
      data: [
        { id: 7, call_log_id: 40, recording_status: 'AVAILABLE' },
        { id: 8, call_log_id: 42, recording_status: 'AVAILABLE' },
      ],
    };

    expect(findRecordingForCall(response, 42)).toEqual({
      id: 8,
      call_log_id: 42,
      recording_status: 'AVAILABLE',
    });
    expect(findRecordingForCall(response, 99)).toBeNull();
  });
});
