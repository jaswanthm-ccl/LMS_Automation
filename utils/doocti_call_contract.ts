export type DooctiRecording = {
  id: number;
  call_log_id: number;
  recording_status: string;
  [key: string]: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

export function extractCallLogId(responseBody: unknown): number | null {
  const root = asRecord(responseBody);
  const data = asRecord(root?.data);
  const value = Number(data?.call_log_id);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function findRecordingForCall(
  responseBody: unknown,
  callLogId: number,
): DooctiRecording | null {
  const root = asRecord(responseBody);
  const data = root?.data;
  const nested = asRecord(data)?.data;
  const rows = Array.isArray(data) ? data : Array.isArray(nested) ? nested : [];

  const match = rows.find((row) => Number(asRecord(row)?.call_log_id) === callLogId);
  if (!match) return null;

  const record = asRecord(match);
  const id = Number(record?.id);
  const recordingId = Number(record?.call_log_id);
  const status = record?.recording_status;
  if (!Number.isInteger(id) || !Number.isInteger(recordingId) || typeof status !== 'string') {
    return null;
  }

  return {
    ...record,
    id,
    call_log_id: recordingId,
    recording_status: status,
  } as DooctiRecording;
}
