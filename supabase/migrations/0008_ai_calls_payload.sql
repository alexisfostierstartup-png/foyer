-- Add request/response payload columns to ai_calls for diagnostic purposes
alter table ai_calls
  add column if not exists request_payload  jsonb,
  add column if not exists response_payload jsonb;
