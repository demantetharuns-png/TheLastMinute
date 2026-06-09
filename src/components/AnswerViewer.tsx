import React, { useState } from "react";
import { CheckCircle2, ChevronRight, ChevronDown, Edit3, Save, RotateCcw, AlertTriangle, FileText, Check } from "lucide-react";
import { ExtractedQuestion } from "../types";

interface AnswerViewerProps {
  questions: ExtractedQuestion[];
  onUpdateEditedText: (
    id: string,
    markType: "mark5" | "mark10",
    newText: string
  ) => void;
  onResetEditedText: (id: string, markType: "mark5" | "mark10") => void;
}

export default function AnswerViewer({
  questions,
  onUpdateEditedText,
  onResetEditedText,
}: AnswerViewerProps) {
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ id: string; field: "mark5" | "mark10" } | null>(null);
  const [editTextVal, setEditTextVal] = useState("");

  const completedQuestions = questions.filter((q) => q.status === "completed" && (q.mark5 || q.mark10));

  // Auto-activate first completed question if none is active
  React.useEffect(() => {
    if (!activeQuestionId && completedQuestions.length > 0) {
      setActiveQuestionId(completedQuestions[0].id);
    }
  }, [completedQuestions, activeQuestionId]);

  const countWords = (str: string) => {
    if (!str.trim()) return 0;
    return str.trim().split(/\s+/).length;
  };

  const getWordCountStatus = (count: number, min: number) => {
    if (count >= min) {
      return {
        label: `${count} words ✓ (Passed)`,
        classes: "bg-emerald-950/40 text-emerald-300 border-emerald-900/60",
        pass: true,
      };
    }
    return {
      label: `${count} words ⚠ (Needs Min. ${min})`,
      classes: "bg-amber-950/40 text-amber-300 border-amber-900/60",
      pass: false,
    };
  };

  const startEditing = (id: string, field: "mark5" | "mark10", currentText: string) => {
    setEditingField({ id, field });
    setEditTextVal(currentText);
  };

  const saveEditing = (id: string, field: "mark5" | "mark10") => {
    onUpdateEditedText(id, field, editTextVal);
    setEditingField(null);
  };

  const cancelEditing = () => {
    setEditingField(null);
  };

  if (completedQuestions.length === 0) {
    return (
      <div id="no-answers-pane" className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
        <FileText className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
        <p className="font-semibold text-zinc-300">No Answers Compiled Yet</p>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
          Please select questions in Step 02 and trigger the pipeline. Your high-scoring answers will render here.
        </p>
      </div>
    );
  }

  return (
    <div id="answer-viewer-module" className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-6 text-zinc-100">
      
      {/* Module Title */}
      <div>
        <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          03 / Interactive Answer Viewer & Compliance Proofing
        </h2>
        <p className="text-xs text-zinc-400 mt-1">
          Review generated responses below. You can customize text inline while maintaining dynamic word targets securely.
        </p>
      </div>

      {/* Accordion Container */}
      <div className="space-y-3">
        {completedQuestions.map((q, index) => {
          const isOpen = activeQuestionId === q.id;
          return (
            <div
              key={q.id}
              className={`rounded-xl border transition-all ${
                isOpen
                  ? "border-indigo-500/30 bg-indigo-950/10 shadow-sm"
                  : "border-zinc-800/80 bg-zinc-950 hover:border-zinc-700"
              }`}
            >
              {/* Accordion Trigger Head */}
              <button
                onClick={() => setActiveQuestionId(isOpen ? null : q.id)}
                className="w-full flex items-center justify-between p-4 text-left cursor-pointer transition-all"
              >
                <div className="flex items-start gap-4">
                  <span className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400 border border-zinc-800">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold tracking-wide uppercase bg-indigo-950/60 text-indigo-300 border border-indigo-900/40 px-2.5 py-0.5 rounded">
                        {q.category}
                      </span>
                      <span className="text-xs text-zinc-500 font-medium">Question {index + 1}</span>
                    </div>
                    <h3 className="font-semibold text-zinc-200 text-sm mt-1 sm:text-base pr-5">
                      {q.text}
                    </h3>
                  </div>
                </div>
              </button>

              {/* Accordion Content Body */}
              {isOpen && (
                <div className="p-5 border-t border-zinc-800 bg-zinc-900/20 space-y-6 rounded-b-xl">
                  
                  {/* 5-MARK ANSWER ZONE */}
                  {q.mark5 && (q.answerType === "5mark" || q.answerType === "both") && (
                    <div className="p-4 bg-zinc-950/60 rounded-xl border border-zinc-800/80 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-extrabold uppercase bg-indigo-950 text-indigo-300 border border-indigo-900/60 px-2.5 py-1 rounded-md">
                            5-Mark Exam Sheet
                          </span>
                        </div>
                        
                        {/* Word counter flag! */}
                        <div className="flex items-center gap-2">
                          {(() => {
                            const rawText = q.mark5.userEditedText || q.mark5.text;
                            const count = countWords(rawText);
                            const audit = getWordCountStatus(count, 80);
                            return (
                              <span className={`text-[10px] font-semibold border px-2.5 py-1 rounded-full ${audit.classes}`}>
                                Word Count: {audit.label}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Editing Block */}
                      {editingField?.id === q.id && editingField?.field === "mark5" ? (
                        <div className="space-y-3">
                          <textarea
                            value={editTextVal}
                            onChange={(e) => setEditTextVal(e.target.value)}
                            className="w-full h-40 p-4 border border-indigo-500 bg-zinc-950 rounded-xl text-zinc-200 text-sm leading-relaxed focus:ring-1 focus:ring-indigo-500/40 outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEditing(q.id, "mark5")}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-1.5 px-3.5 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-all active:scale-[0.98]"
                            >
                              <Save className="w-3.5 h-3.5" /> Save Changes
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 font-semibold text-xs py-1.5 px-3.5 rounded-lg cursor-pointer transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-sm text-zinc-300 font-normal leading-relaxed whitespace-pre-wrap font-sans bg-zinc-950 p-4 rounded-xl border border-zinc-900">
                            {q.mark5.userEditedText || q.mark5.text}
                          </div>
                          
                          {/* Inner Action Controls */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditing(q.id, "mark5", q.mark5?.userEditedText || q.mark5?.text || "")}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-zinc-100 py-1 px-2.5 hover:bg-zinc-900 rounded-lg border border-zinc-800 bg-zinc-950"
                            >
                              <Edit3 className="w-3 h-3" /> Customize Response
                            </button>
                            {q.mark5.userEditedText && (
                              <button
                                onClick={() => onResetEditedText(q.id, "mark5")}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-350 py-1 px-2 hover:bg-rose-950/20 rounded-lg border border-rose-900/60 bg-zinc-950"
                              >
                                <RotateCcw className="w-3 h-3" /> Revert
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 10-MARK ANSWER ZONE */}
                  {q.mark10 && (q.answerType === "10mark" || q.answerType === "both") && (
                    <div className="p-4 bg-zinc-950/60 rounded-xl border border-zinc-800/80 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-extrabold uppercase bg-emerald-950/80 text-emerald-400 border border-emerald-900 px-2.5 py-1 rounded-md">
                            10-Mark Detailed Answer
                          </span>
                        </div>

                        {/* Word counter flag! */}
                        <div className="flex items-center gap-2">
                          {(() => {
                            const rawText = q.mark10.userEditedText || q.mark10.text;
                            const count = countWords(rawText);
                            const audit = getWordCountStatus(count, 180);
                            return (
                              <span className={`text-[10px] font-semibold border px-2.5 py-1 rounded-full ${audit.classes}`}>
                                Word Count: {audit.label}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Editing Block */}
                      {editingField?.id === q.id && editingField?.field === "mark10" ? (
                        <div className="space-y-3">
                          <textarea
                            value={editTextVal}
                            onChange={(e) => setEditTextVal(e.target.value)}
                            className="w-full h-56 p-4 border border-indigo-500 bg-zinc-950 rounded-xl text-zinc-200 text-sm leading-relaxed focus:ring-1 focus:ring-indigo-500/40 outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEditing(q.id, "mark10")}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-1.5 px-3.5 rounded-lg inline-flex items-center gap-1 cursor-pointer transition-all active:scale-[0.98]"
                            >
                              <Save className="w-3.5 h-3.5" /> Save Changes
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 font-semibold text-xs py-1.5 px-3.5 rounded-lg cursor-pointer transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-sm text-zinc-300 font-normal leading-relaxed whitespace-pre-wrap font-sans bg-zinc-950 p-4 rounded-xl border border-zinc-900">
                            {q.mark10.userEditedText || q.mark10.text}
                          </div>

                          {/* Inner Action Controls */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditing(q.id, "mark10", q.mark10?.userEditedText || q.mark10?.text || "")}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-zinc-100 py-1 px-2.5 hover:bg-zinc-900 rounded-lg border border-zinc-800 bg-zinc-950"
                            >
                              <Edit3 className="w-3 h-3" /> Customize Response
                            </button>
                            {q.mark10.userEditedText && (
                              <button
                                onClick={() => onResetEditedText(q.id, "mark10")}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-350 py-1 px-2 hover:bg-rose-955/20 rounded-lg border border-rose-900/60 bg-zinc-950"
                              >
                                <RotateCcw className="w-3 h-3" /> Revert
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
