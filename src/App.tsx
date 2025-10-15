import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowRight, CheckCircle2, FileText, Loader2, RefreshCcw, UploadCloud } from "lucide-react";

import { PdfPreview } from "@/components/pdf-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { POLL_INTERVAL_MS, buildUrl, fetchJobStatus, submitJob } from "@/lib/api";
import type { JobStatusPayload } from "@/lib/api";
import { cn } from "@/lib/utils";

const DEFAULT_BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ??
  (import.meta.env.DEV ? "http://localhost:8000" : "https://web-production-97ae3.up.railway.app/");

type Stage = "idle" | "details" | "processing" | "completed";

function formatStatusLabel(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes)) {
    return "";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const precision = size >= 10 || unit === 0 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unit]}`;
}

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetLanguage, setTargetLanguage] = useState("nl");
  const [sourceLanguage, setSourceLanguage] = useState("");
  const backendUrl = DEFAULT_BACKEND_URL;

  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatusPayload | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let isMounted = true;
    let intervalId: number | undefined;

    const poll = async () => {
      try {
        const payload = await fetchJobStatus(backendUrl, jobId);
        if (!isMounted) {
          return;
        }
        setJobStatus(payload);
        const normalizedStatus = payload.status.toLowerCase();

        if (normalizedStatus === "completed") {
          setStage("completed");
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = undefined;
          }
        } else if (normalizedStatus === "failed") {
          setStage("details");
          setError(payload.error ? `Job ${payload.job_id} failed: ${payload.error}` : "The backend reported a failure.");
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = undefined;
          }
        } else {
          setStage("processing");
        }
      } catch (pollError) {
        if (!isMounted) {
          return;
        }
        setError(pollError instanceof Error ? pollError.message : "Unable to check job status.");
        setStage("details");
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = undefined;
        }
      }
    };

    poll();
    intervalId = window.setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [backendUrl, jobId]);

  const resolvedDownloadUrl = useMemo(() => {
    if (!jobStatus?.download_url) {
      return null;
    }
    return buildUrl(backendUrl, jobStatus.download_url);
  }, [backendUrl, jobStatus?.download_url]);

  const resolvedPdfUrl = useMemo(() => {
    if (!jobStatus?.pdf_download_url) {
      return null;
    }
    return buildUrl(backendUrl, jobStatus.pdf_download_url);
  }, [backendUrl, jobStatus?.pdf_download_url]);

  function clearFileSelection() {
    setSelectedFile(null);
    setStage("idle");
    setJobStatus(null);
    setJobId(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function resetFlow() {
    setStage("idle");
    setSelectedFile(null);
    setJobStatus(null);
    setJobId(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileSelection(file: File | null) {
    if (!file) {
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pptx")) {
      setError("Please upload a .pptx presentation.");
      return;
    }
    setSelectedFile(file);
    setStage("details");
    setJobStatus(null);
    setJobId(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!isDragActive) {
      setIsDragActive(true);
    }
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (isDragActive) {
      setIsDragActive(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0];
    handleFileSelection(file ?? null);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Please choose a PPTX presentation to translate.");
      return;
    }

    if (!targetLanguage.trim()) {
      setError("Please specify a target language code.");
      return;
    }

    setStage("processing");
    setError(null);
    setJobStatus(null);
    setJobId(null);

    try {
      const response = await submitJob({
        backendUrl,
        file: selectedFile,
        targetLanguage: targetLanguage.trim(),
        sourceLanguage: sourceLanguage.trim() || undefined,
      });
      setJobId(response.job_id);
      setJobStatus({ job_id: response.job_id, status: response.status });
    } catch (submitError) {
      setStage("details");
      setError(submitError instanceof Error ? submitError.message : "Something went wrong while submitting the job.");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-16">
        <div className="w-full space-y-10">
          <header className="space-y-4 text-center">
            <span className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-purple-200">
              Precise & polished
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Translate your presentation with confidence
            </h1>
            <p className="mx-auto max-w-2xl text-sm text-slate-300 md:text-base">
              Drop in your PowerPoint, choose the destination language, and let the backend rebuild a beautifully translated deck — layout and media intact.
            </p>
          </header>

          {error ? (
            <div className="mx-auto max-w-2xl rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {(stage === "idle" || stage === "details") && (
            <section className="mx-auto w-full max-w-4xl space-y-8">
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  "group relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center gap-6 overflow-hidden rounded-3xl border-2 border-dashed border-white/15 bg-white/5 p-12 text-center transition-all duration-300",
                  "hover:border-purple-400/60 hover:bg-white/10 hover:shadow-[0_0_80px_-30px_rgba(168,85,247,0.8)]",
                  isDragActive && "border-purple-400 bg-purple-500/10 shadow-[0_0_80px_-30px_rgba(168,85,247,0.9)]",
                  selectedFile ? "border-purple-400/40 bg-white/10" : "",
                )}
                onClick={openFilePicker}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openFilePicker();
                  }
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDragEnd={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/10 text-purple-200 shadow-inner shadow-white/20 transition group-hover:border-purple-400/40 group-hover:bg-purple-500/20">
                  <UploadCloud className="h-10 w-10" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold text-white md:text-3xl">Drop your .pptx here</h2>
                  <p className="text-sm text-slate-300">
                    We’ll keep every slide structure pristine while translating your content.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-300">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      openFilePicker();
                    }}
                    className="border border-white/15 bg-white/10 text-white hover:bg-white/20"
                  >
                    Browse files
                  </Button>
                  <span className="text-xs uppercase tracking-[0.32em] text-slate-400">or drag & drop</span>
                </div>

                {selectedFile ? (
                  <div className="w-full max-w-md rounded-2xl border border-white/15 bg-white/10 p-4 text-left text-sm text-slate-200">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-2 font-medium text-white">
                          <FileText className="h-4 w-4" />
                          {selectedFile.name}
                        </span>
                        <span className="text-xs text-slate-400">{formatFileSize(selectedFile.size)}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            openFilePicker();
                          }}
                          className="border-white/20 bg-transparent text-white hover:bg-white/10"
                        >
                          Replace
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            clearFileSelection();
                          }}
                          className="text-slate-300 hover:text-white"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="pointer-events-none absolute inset-x-0 -bottom-40 h-80 bg-gradient-to-t from-purple-500/20 via-transparent to-transparent blur-3xl transition group-hover:from-purple-500/30" />
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pptx"
                className="hidden"
                onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
              />

              {selectedFile ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                      <div className="space-y-4 text-left">
                        <div className="space-y-2">
                          <Label htmlFor="target-language" className="text-xs uppercase tracking-[0.3em] text-slate-400">
                            Target language
                          </Label>
                          <Input
                            id="target-language"
                            value={targetLanguage}
                            onChange={(event) => setTargetLanguage(event.target.value)}
                            placeholder="e.g. nl"
                            className="border-white/15 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-white/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="source-language" className="text-xs uppercase tracking-[0.3em] text-slate-400">
                            Source language (optional)
                          </Label>
                          <Input
                            id="source-language"
                            value={sourceLanguage}
                            onChange={(event) => setSourceLanguage(event.target.value)}
                            placeholder="Let the backend auto-detect when empty"
                            className="border-white/15 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-white/30"
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className="h-12 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-sky-500 text-white shadow-lg shadow-purple-500/25 transition hover:brightness-110"
                      >
                        Start translation
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="uppercase tracking-[0.3em]">Target:</span>{" "}
                      <span className="font-medium text-white">{targetLanguage || "not set"}</span>
                      {sourceLanguage ? (
                        <>
                          <span className="uppercase tracking-[0.3em]">Source:</span>{" "}
                          <span className="font-medium text-white">{sourceLanguage}</span>
                        </>
                      ) : null}
                    </div>
                  </form>
                </div>
              ) : null}
            </section>
          )}

          {stage === "processing" && (
            <section className="mx-auto w-full max-w-4xl">
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/10 p-12 text-center shadow-lg shadow-purple-500/20 backdrop-blur">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-sky-500/10 to-transparent opacity-90" />
                <div className="relative z-10 space-y-6">
                  <div className="flex justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-purple-500/40 bg-purple-500/20">
                      <Loader2 className="h-8 w-8 animate-spin text-purple-200" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-semibold text-white">Translating your slides…</h2>
                    <p className="text-sm text-slate-200">
                      We’re preserving layouts and visuals while the backend processes the content.
                    </p>
                  </div>
                  <div className="mx-auto w-full max-w-xs rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs text-white/80">
                    {jobStatus?.status ? `Current status: ${formatStatusLabel(jobStatus.status)}` : "Uploading to backend…"}
                  </div>
                  <div className="relative mx-auto h-1 w-full max-w-md overflow-hidden rounded-full bg-white/10">
                    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                  </div>
                  <div className="flex flex-col items-center gap-2 text-xs text-slate-300">
                    {selectedFile ? (
                      <span>
                        Translating <span className="text-white">{selectedFile.name}</span> →{" "}
                        <span className="text-white uppercase tracking-[0.3em]">{targetLanguage}</span>
                      </span>
                    ) : null}
                    <span>Checking progress every {POLL_INTERVAL_MS / 1000}s.</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {stage === "completed" && (
            <section className="mx-auto w-full max-w-6xl space-y-8">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <div className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur">
                  <div className="mb-4 space-y-1 text-left">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">PDF preview</p>
                    <p className="text-xs text-slate-400">
                      Quick visual reference — the preview may differ slightly from the exported PowerPoint.
                    </p>
                  </div>
                  {resolvedPdfUrl ? (
                    <PdfPreview url={resolvedPdfUrl} />
                  ) : (
                    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center text-sm text-slate-200">
                      <FileText className="h-8 w-8 text-slate-300" />
                      <p>The backend did not provide a PDF preview for this job.</p>
                      {jobStatus?.meta?.pdf_error ? (
                        <p className="text-xs text-amber-200">Note: {jobStatus.meta.pdf_error}</p>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-6">
                  <div className="rounded-3xl border border-white/10 bg-white/10 p-6 text-left shadow-lg shadow-purple-500/10 backdrop-blur">
                    <div className="flex items-center gap-2 text-sm text-emerald-200">
                      <CheckCircle2 className="h-5 w-5" />
                      Ready to download
                    </div>
                    <h2 className="mt-3 text-3xl font-semibold text-white">Translation complete</h2>
                    <p className="text-sm text-slate-200">
                      Your presentation is now available in{" "}
                      <span className="font-semibold text-white uppercase tracking-[0.3em]">{targetLanguage}</span>.
                    </p>

                    <div className="mt-6 flex flex-col gap-3">
                      <Button
                        asChild
                        className="h-12 bg-gradient-to-r from-purple-500 via-indigo-500 to-sky-500 text-white shadow-lg shadow-purple-500/25 transition hover:brightness-110"
                      >
                        <a href={resolvedDownloadUrl ?? "#"} download target="_blank" rel="noreferrer">
                          Download PPTX
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                    </div>

                    <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-200">
                      {selectedFile ? (
                        <div className="text-slate-300">
                          Original file: <span className="font-medium text-white">{selectedFile.name}</span>
                        </div>
                      ) : null}
                      <div className="text-slate-300">
                        Status:{" "}
                        <span className="font-medium text-emerald-200">
                          {jobStatus?.status ? formatStatusLabel(jobStatus.status) : "Completed"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetFlow}
                    className="h-12 border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Translate another deck
                  </Button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
