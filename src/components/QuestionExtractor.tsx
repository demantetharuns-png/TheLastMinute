import React, { useState } from "react";
import { CheckSquare, Square, Settings2, Sparkles, Plus, Trash2 } from "lucide-react";
import { ExtractedQuestion } from "../types";

interface QuestionExtractorProps {
  questions: ExtractedQuestion[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onUpdateAnswerType: (id: string, type: "5mark" | "10mark" | "both") => void;
  onSetGlobalAnswerType: (type: "5mark" | "10mark" | "both") => void;
  onAddManualQuestion: (text: string) => void;
  onDeleteQuestion: (id: string) => void;
  loading: boolean;
  onStartGeneration: () => void;
}

export default function QuestionExtractor({
  questions,
  onToggleSelect,
  onToggleSelectAll,
  onUpdateAnswerType,
  onSetGlobalAnswerType,
  onAddManualQuestion,
  onDeleteQuestion,
  loading,
  onStartGeneration,
}: QuestionExtractorProps) {
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionCategory, setNewQuestionCategory] = useState("");

  const selectedCount = questions.filter((q) => q.selected).length;
  const isAllSelected = questions.length > 0 && selectedCount === questions.length;

  const handleCreateQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;
    onAddManualQuestion(newQuestionText.trim());
    setNewQuestionText("");
  };

  return (
    <div id="question-extractor-module" className="bg-zinc-900/50 border border-zinc-800 text-zinc-100 rounded-2xl p-6 space-y-6">
      
      {/* Extractor Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2 leading-tight">
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
            02 / Selection Checklist & Weight Calibration
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Pick critical items, then verify dynamic 5-mark and 10-mark word targets.
          </p>
        </div>

        {/* Action Preset Buttons */}
        {questions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 bg-zinc-950 p-2 rounded-xl border border-zinc-800 justify-start self-start">
            <span className="text-[10px] text-zinc-500 font-bold uppercase py-1 px-2.5 flex items-center gap-1">
              <Settings2 className="w-3.5 h-3.5" />
              Weight Preset:
            </span>
            <button
              onClick={() => onSetGlobalAnswerType("5mark")}
              className="text-xs bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer"
            >
              5m Only
            </button>
            <button
              onClick={() => onSetGlobalAnswerType("10mark")}
              className="text-xs bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer"
            >
              10m Only
            </button>
            <button
              onClick={() => onSetGlobalAnswerType("both")}
              className="text-xs bg-indigo-950/60 border border-indigo-800 text-indigo-300 hover:bg-indigo-900/60 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer"
            >
              Both
            </button>
          </div>
        )}
      </div>

      {questions.length === 0 ? (
        <div className="text-center py-10 border border-zinc-800 bg-zinc-950/20 rounded-2xl">
          <p className="text-zinc-500 text-sm font-medium">
            No exam questions loaded or detected yet.
          </p>
          <p className="text-[11px] text-zinc-600 mt-1">
            Please complete Step 01 above by uploading or typing exam concepts first.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Subheader Select All Row */}
          <div className="flex items-center justify-between bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
            <button
              onClick={() => onToggleSelectAll(!isAllSelected)}
              className="flex items-center gap-2 text-xs font-semibold text-zinc-300 hover:text-zinc-100 transition-all cursor-pointer"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-indigo-400" />
              ) : (
                <Square className="w-4 h-4 text-zinc-600" />
              )}
              Select All ({questions.length} Items)
            </button>
            <span className="text-[11px] font-mono font-bold text-indigo-300 bg-indigo-950/60 border border-indigo-900/60 px-2.5 py-1 rounded-md">
              {selectedCount} Sizable Units Scheduled
            </span>
          </div>

          {/* List of Questions */}
          <div className="max-h-96 overflow-y-auto pr-1 border border-zinc-800 rounded-xl bg-zinc-950 p-3 space-y-2">
            {questions.map((q, index) => (
              <div
                key={q.id}
                className={`p-3.5 rounded-xl border transition-all flex flex-col md:flex-row md:items-center gap-4 justify-between ${
                  q.selected
                    ? "bg-indigo-950/15 border-indigo-500/20"
                    : "bg-zinc-900/30 hover:bg-zinc-900/60 border-transparent"
                }`}
              >
                {/* Selector */}
                <div className="flex items-start gap-3 max-w-[100%] md:max-w-[70%]">
                  <button
                    onClick={() => onToggleSelect(q.id)}
                    className="mt-1 transition-all text-zinc-500 hover:text-indigo-400 cursor-pointer"
                  >
                    {q.selected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 shrink-0 text-zinc-700" />
                    )}
                  </button>
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded uppercase tracking-wide">
                      {q.category || "General"}
                    </span>
                    <p className="text-sm text-zinc-200 font-medium leading-relaxed">
                      {q.text}
                    </p>
                  </div>
                </div>

                {/* Question level markings */}
                <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 border-zinc-900 pt-3.5 md:pt-0">
                  <div className="flex bg-zinc-950 hover:border-zinc-700 border border-zinc-800 rounded-lg p-0.5">
                    <button
                      onClick={() => onUpdateAnswerType(q.id, "5mark")}
                      disabled={!q.selected}
                      className={`text-[10px] px-2.5 py-1.5 rounded-md transition-all font-medium ${
                        !q.selected 
                          ? "opacity-30 cursor-not-allowed" 
                          : q.answerType === "5mark"
                          ? "bg-indigo-600 text-white font-bold"
                          : "text-zinc-400 hover:text-zinc-100"
                      }`}
                    >
                      5m
                    </button>
                    <button
                      onClick={() => onUpdateAnswerType(q.id, "10mark")}
                      disabled={!q.selected}
                      className={`text-[10px] px-2.5 py-1.5 rounded-md transition-all font-medium ${
                        !q.selected 
                          ? "opacity-30 cursor-not-allowed" 
                          : q.answerType === "10mark"
                          ? "bg-indigo-600 text-white font-bold"
                          : "text-zinc-400 hover:text-zinc-100"
                      }`}
                    >
                      10m
                    </button>
                    <button
                      onClick={() => onUpdateAnswerType(q.id, "both")}
                      disabled={!q.selected}
                      className={`text-[10px] px-2.5 py-1.5 rounded-md transition-all font-medium ${
                        !q.selected 
                          ? "opacity-30 cursor-not-allowed" 
                          : q.answerType === "both"
                          ? "bg-indigo-600 text-white font-bold"
                          : "text-zinc-400 hover:text-zinc-100"
                      }`}
                    >
                      Both
                    </button>
                  </div>

                  {/* Delete Row */}
                  <button
                    onClick={() => onDeleteQuestion(q.id)}
                    className="p-1 px-2 text-zinc-600 hover:text-rose-400 rounded-lg hover:bg-rose-950/20 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Form to insert custom manual question */}
          <form onSubmit={handleCreateQuestion} className="flex gap-2 bg-zinc-950 p-2 rounded-xl border border-zinc-800 items-center">
            <Plus className="w-4 h-4 text-zinc-500 shrink-0 ml-2" />
            <input
              type="text"
              placeholder="Inject manual exam assignment topic or flash question here..."
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              className="bg-transparent border-0 ring-0 outline-none text-xs text-zinc-300 w-full focus:ring-0 placeholder:text-zinc-600 shadow-none font-normal"
            />
            <button
              type="submit"
              className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold text-[10px] tracking-wider py-1.5 px-3.5 rounded-lg whitespace-nowrap uppercase cursor-pointer transition-all active:scale-[0.98]"
            >
              Add Item
            </button>
          </form>

          {/* Big Trigger Generation Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={onStartGeneration}
              disabled={selectedCount === 0 || loading}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-550 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/15 cursor-pointer ${
                (selectedCount === 0 || loading) && "opacity-50 cursor-not-allowed"
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Drafting Answers...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  Compose Custom Answer Key ({selectedCount} Questions)
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
