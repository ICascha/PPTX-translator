const REQUEST_TIMEOUT = 60_000;
const POLL_INTERVAL_MS = 2_000;

export interface SubmitJobParams {
  backendUrl: string;
  file: File;
  targetLanguage: string;
  sourceLanguage?: string;
}

export interface SubmitJobResponse {
  job_id: string;
  status: string;
}

export interface JobMeta {
  translated_strings?: number;
  pdf_error?: string;
  [key: string]: unknown;
}

export interface JobStatusPayload {
  job_id: string;
  status: string;
  download_url?: string;
  pdf_download_url?: string;
  error?: string;
  meta?: JobMeta;
  [key: string]: unknown;
}

export function buildUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path, normalizedBase).toString();
}

async function fetchWithTimeout(input: RequestInfo, init?: RequestInit & { timeout?: number }) {
  const { timeout = REQUEST_TIMEOUT, signal, ...rest } = init ?? {};
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(input, {
      signal: signal ?? controller.signal,
      ...rest,
    });
    return response;
  } finally {
    window.clearTimeout(id);
  }
}

export async function submitJob({ backendUrl, file, targetLanguage, sourceLanguage }: SubmitJobParams) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("target_language", targetLanguage);
  if (sourceLanguage) {
    formData.append("source_language", sourceLanguage);
  }

  const url = buildUrl(backendUrl, "/api/v1/jobs");
  const response = await fetchWithTimeout(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await safeErrorMessage(response);
    throw new Error(message ?? `Upload failed with status ${response.status}`);
  }

  return (await response.json()) as SubmitJobResponse;
}

export async function fetchJobStatus(backendUrl: string, jobId: string) {
  const url = buildUrl(backendUrl, `/api/v1/jobs/${jobId}`);
  const response = await fetchWithTimeout(url, {
    method: "GET",
  });

  if (!response.ok) {
    const message = await safeErrorMessage(response);
    throw new Error(message ?? `Status check failed with status ${response.status}`);
  }

  return (await response.json()) as JobStatusPayload;
}

async function safeErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { detail?: string } | undefined;
    return data?.detail;
  } catch {
    return undefined;
  }
}

export { POLL_INTERVAL_MS };
