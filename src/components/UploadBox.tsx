import React, { useState, useRef } from "react";
import { Upload, FileText, Clipboard, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { InputDocument } from "../types";

interface UploadBoxProps {
  title: string;
  subtitle: string;
  placeholderText: string;
  onDocLoaded: (doc: InputDocument | null) => void;
  document: InputDocument | null;
}

export default function UploadBox({
  title,
  subtitle,
  placeholderText,
  onDocLoaded,
  document,
}: UploadBoxProps) {
  const [dragActive, setDragActive] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: Convert File to Base64
  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === "string") {
          // split the "data:application/pdf;base64," prefix
          const base64Str = reader.result.split(",")[1];
          resolve(base64Str);
        } else {
          reject(new Error("Failed to read file as data URL"));
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileProcess = async (file: File) => {
    setErrorMsg("");
    const isPDF = file.type === "application/pdf" || file.name.endsWith(".pdf");
    const isTXT = file.type === "text/plain" || file.name.endsWith(".txt");

    if (!isPDF && !isTXT) {
      setErrorMsg("Supported file formats are PDF or Text (.txt) files only.");
      return;
    }

    try {
      if (isPDF) {
        const base64 = await getBase64(file);
        onDocLoaded({
          name: file.name,
          size: file.size,
          type: "pdf",
          base64: base64,
        });
      } else {
        const text = await file.text();
        onDocLoaded({
          name: file.name,
          size: file.size,
          type: "text",
          content: text,
        });
      }
    } catch (err: any) {
      setErrorMsg(`Error reading file: ${err.message || "Unknown error"}`);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileProcess(e.target.files[0]);
    }
  };

  const handlePasteSubmit = () => {
    if (!pastedText.trim()) {
      setErrorMsg("Please paste some content before applying.");
      return;
    }
    setErrorMsg("");
    onDocLoaded({
      name: `Custom Pasted Document (${pastedText.split(/\s+/).slice(0, 4).join(" ")}...)`,
      size: new Blob([pastedText]).size,
      type: "text",
      content: pastedText,
    });
  };

  const handleClear = () => {
    onDocLoaded(null);
    setPastedText("");
    setErrorMsg("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div id={`upload-box-${title.replace(/\s+/g, "-").toLowerCase()}`} className="bg-zinc-900/50 border border-zinc-800 text-zinc-100 rounded-2xl p-6 transition-all hover:bg-zinc-900/80 hover:border-zinc-700/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-zinc-100 text-base tracking-tight">{title}</h3>
          <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
        </div>
        {!document && (
          <div className="flex bg-zinc-950 border border-zinc-800/80 rounded-lg p-1 text-[11px] font-medium self-start sm:self-auto">
            <button
              onClick={() => { setPasteMode(false); setErrorMsg(""); }}
              className={`px-3 py-1.5 rounded-md transition-all ${!pasteMode ? "bg-zinc-800 text-zinc-100 font-bold" : "text-zinc-400 hover:text-zinc-100"}`}
            >
              Upload PDF/TXT
            </button>
            <button
              onClick={() => { setPasteMode(true); setErrorMsg(""); }}
              className={`px-3 py-1.5 rounded-md transition-all ${pasteMode ? "bg-zinc-800 text-zinc-100 font-bold" : "text-zinc-400 hover:text-zinc-100"}`}
            >
              Paste Text
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="mb-4 flex items-start gap-2 bg-rose-950/40 text-rose-300 p-3 rounded-xl text-xs font-medium border border-rose-900">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Container */}
      {document ? (
        // State: Loaded
        <div className="border border-indigo-500/30 bg-indigo-950/20 rounded-xl p-5 flex flex-col items-center justify-center text-center">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <p className="font-medium text-zinc-100 text-sm break-all max-w-full px-2">
            {document.name}
          </p>
          <div className="flex gap-2 items-center mt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
              {document.type}
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              {formatSize(document.size)}
            </span>
          </div>

          <button
            onClick={handleClear}
            className="mt-5 inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-rose-400 font-semibold px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-rose-900/60 hover:bg-rose-950/30 bg-zinc-950 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove File
          </button>
        </div>
      ) : pasteMode ? (
        // State: Paste Mode Editing
        <div className="space-y-3">
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={placeholderText}
            className="w-full h-44 text-sm p-4 rounded-xl border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-zinc-200 bg-zinc-950 resize-none font-sans font-normal leading-relaxed transition-all duration-150"
          />
          <button
            onClick={handlePasteSubmit}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
          >
            <Clipboard className="w-4 h-4" />
            Apply Sourced Text
          </button>
        </div>
      ) : (
        // State: File Upload Drag Zone
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl h-44 flex flex-col items-center justify-center text-center p-6 cursor-pointer transition-all ${
            dragActive
              ? "border-indigo-500 bg-indigo-950/30"
              : "border-zinc-800 bg-zinc-950/40 hover:border-indigo-500/50 hover:bg-zinc-900/40"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept=".pdf,.txt"
            className="hidden"
          />
          <div className="p-3 bg-zinc-900 text-zinc-400 rounded-full mb-3 border border-zinc-800 transition-all">
            <Upload className="w-6 h-6 text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-300">
            Drag & drop file here, or <span className="text-indigo-400 hover:underline font-semibold">browse</span>
          </p>
          <div className="flex items-center gap-1.5 mt-2 justify-center text-[11px] text-zinc-500 font-medium">
            <FileText className="w-3.5 h-3.5 text-zinc-500" />
            <span>PDF or TXT template up to 25MB</span>
          </div>
        </div>
      )}
    </div>
  );
}
