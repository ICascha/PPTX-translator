import { useEffect, useMemo, useRef, useState } from "react";

import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Document, Page } from "react-pdf";
import type { PDFPageProxy } from "pdfjs-dist/types/src/display/api";

import { Button } from "@/components/ui/button";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

interface PdfPreviewProps {
  url: string;
}

export function PdfPreview({ url }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageAspectRatio, setPageAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    setPageNumber(1);
    setNumPages(null);
    setScale(1);
    setLoading(true);
    setError(null);
  }, [url]);

  function handleLoadSuccess({ numPages: total }: { numPages: number }) {
    setNumPages(total);
    setLoading(false);
  }

  function handleLoadError(eventError: Error) {
    setError(eventError.message);
    setLoading(false);
  }

  function handlePageLoadSuccess(page: PDFPageProxy) {
    const [xMin, yMin, xMax, yMax] = page.view;
    const width = Math.max(xMax - xMin, 1);
    const height = Math.max(yMax - yMin, 1);
    setPageAspectRatio(height / width);
    setLoading(false);
  }

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      if (!Array.isArray(entries) || !entries.length) {
        return;
      }
      const entry = entries[0];
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const canGoPrev = pageNumber > 1;
  const canGoNext = numPages ? pageNumber < numPages : false;
  const canZoomOut = scale > 0.6;
  const canZoomIn = scale < 2.4;

  const baseWidth = useMemo(() => {
    if (!containerWidth) {
      return 640;
    }
    return Math.min(Math.max(containerWidth - 64, 320), 1024);
  }, [containerWidth]);

  const pageWidth = Math.round(baseWidth * scale);

  const previewMinHeight = useMemo(() => {
    if (!pageAspectRatio) {
      return undefined;
    }
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
    const calculatedHeight = pageWidth * pageAspectRatio + 64;
    return viewportHeight ? Math.min(calculatedHeight, viewportHeight * 0.7) : calculatedHeight;
  }, [pageAspectRatio, pageWidth]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setPageNumber((prev) => Math.max(prev - 1, 1))} disabled={!canGoPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-semibold text-slate-700">
            Page {pageNumber}
            {numPages ? ` of ${numPages}` : ""}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPageNumber((prev) => Math.min(prev + 1, numPages ?? prev + 1))}
            disabled={!canGoNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setScale((prev) => Math.max(Math.round((prev - 0.1) * 10) / 10, 0.6))}
            disabled={!canZoomOut}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-semibold text-slate-700">{Math.round(scale * 100)}%</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setScale((prev) => Math.min(Math.round((prev + 0.1) * 10) / 10, 2.4))}
            disabled={!canZoomIn}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex max-h-[70vh] min-h-[320px] w-full items-center justify-center overflow-auto rounded-xl border border-slate-200 bg-white/70 p-4"
        style={previewMinHeight ? { minHeight: previewMinHeight } : undefined}
      >
        <Document
          file={url}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
          loading={
            <div className="flex flex-col items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
              <span>Loading PDF preview…</span>
            </div>
          }
          error={
            <div className="text-sm text-rose-600">
              Unable to load the PDF preview.{" "}
              <a href={url} target="_blank" rel="noreferrer" className="underline">
                Open original PDF
              </a>
              .
            </div>
          }
          className="flex w-full justify-center"
        >
          <Page
            pageNumber={pageNumber}
            width={pageWidth}
            onLoadSuccess={handlePageLoadSuccess}
            loading={
              <div className="flex flex-col items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                <span>Rendering page…</span>
              </div>
            }
            renderAnnotationLayer
            renderTextLayer
            className="transition-transform duration-200 ease-out [&>canvas]:rounded-2xl [&>canvas]:border [&>canvas]:border-slate-200 [&>canvas]:shadow-xl"
          />
        </Document>
      </div>

      {loading && !error ? (
        <p className="text-xs text-slate-500">Fetching the PDF from the backend…</p>
      ) : null}
      {error ? <p className="text-xs text-rose-600">Error: {error}</p> : null}
      <p className="text-xs text-slate-400">
        Preview only — the rendered PDF may differ slightly from the final PowerPoint.
      </p>
    </div>
  );
}
