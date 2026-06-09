import React, { useState } from "react";
import { Sparkles, BookOpen, Download, AlertCircle, CheckCircle2, ListChecks, HelpCircle, FileCheck2, Cpu } from "lucide-react";
import UploadBox from "./components/UploadBox";
import QuestionExtractor from "./components/QuestionExtractor";
import AnswerViewer from "./components/AnswerViewer";
import { generateStudyGuidePDF } from "./utils/pdfGenerator";
import { InputDocument, ExtractedQuestion } from "./types";

export default function App() {
  // Main Input Documents
  const [subjectModule, setSubjectModule] = useState<InputDocument | null>(null);
  const [questionBank, setQuestionBank] = useState<InputDocument | null>(null);

  // Loaded Questions list
  const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);

  // Page Action / Loading states
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [generatingAnswers, setGeneratingAnswers] = useState(false);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number | null>(null);

  // Global announcements
  const [errorHeader, setErrorHeader] = useState("");
  const [successHeader, setSuccessHeader] = useState("");

  // 1. Trigger Extractor of Questions from Question Bank
  const handleExtractQuestions = async () => {
    if (!questionBank) return;
    setErrorHeader("");
    setSuccessHeader("");
    setLoadingQuestions(true);

    try {
      const response = await fetch("/api/extract-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionBank }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Failed to scan questions from Question Bank.");
      }

      const resData = await response.json();
      if (!resData.questions || !Array.isArray(resData.questions)) {
        throw new Error("Invalid output format returned by AI scanner.");
      }

      // Map response standard format to our local state indicators
      const mapped: ExtractedQuestion[] = resData.questions.map((q: any) => ({
        id: q.id || `q_${Math.random().toString(36).substr(2, 9)}`,
        text: q.text,
        category: q.category || "General",
        selected: true,
        answerType: "both",
        status: "idle",
      }));

      setQuestions(mapped);
      setSuccessHeader(`Success! AI has recognized ${mapped.length} distinct questions from your syllabus bank.`);
    } catch (err: any) {
      console.error(err);
      setErrorHeader(err.message || "Something went wrong during extraction.");
    } finally {
      setLoadingQuestions(false);
    }
  };

  // 2. Sequential Generator Queue (Prevents rate-limits / token truncations / provides premium live feed)
  const handleGenerateAnswers = async () => {
    const selectedQuestions = questions.filter((q) => q.selected);
    if (selectedQuestions.length === 0) {
      setErrorHeader("Please select at least one question from the checklist to solve.");
      return;
    }
    if (!subjectModule) {
      setErrorHeader("A Subject Module material is required, so the AI can source factual answers.");
      return;
    }

    setErrorHeader("");
    setSuccessHeader("");
    setGeneratingAnswers(true);

    // Initialize state
    const cleanQuestions = questions.map((q) => {
      if (q.selected) {
        return { ...q, status: "idle" as const, error: undefined, mark5: undefined, mark10: undefined };
      }
      return q;
    });
    setQuestions(cleanQuestions);

    // Dynamic serial processing
    for (let i = 0; i < cleanQuestions.length; i++) {
       const q = cleanQuestions[i];
       if (!q.selected) continue;

       // Set index for interactive display
       setCurrentQueueIndex(i);

       // Update status of this question in State
       setQuestions((prev) =>
         prev.map((item) => (item.id === q.id ? { ...item, status: "generating" } : item))
       );

       try {
         const response = await fetch("/api/generate-answers", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
             subjectModule,
             question: q.text,
             type: q.answerType,
           }),
         });

         if (!response.ok) {
           const errRes = await response.json();
           throw new Error(errRes.error || "Generation endpoint returned status error.");
         }

         const answerData = await response.json();
         
         // Feed answers back into list
         setQuestions((prev) =>
           prev.map((item) => {
             if (item.id === q.id) {
               return {
                 ...item,
                 status: "completed",
                 mark5: answerData.mark5 ? { text: answerData.mark5.text, wordCount: answerData.mark5.wordCount } : undefined,
                 mark10: answerData.mark10 ? { text: answerData.mark10.text, wordCount: answerData.mark10.wordCount } : undefined,
               };
             }
             return item;
           })
         );
       } catch (err: any) {
         console.error("Single item failed:", err);
         setQuestions((prev) =>
           prev.map((item) =>
             item.id === q.id ? { ...item, status: "error", error: err.message || "Failed to solve." } : item
           )
         );
       }
    }

    setGeneratingAnswers(false);
    setCurrentQueueIndex(null);
    setSuccessHeader("All selected questions processed! Verify syllabus coverage and word limits below.");
  };

  // State mutator functions for Extracted Checklist
  const handleToggleSelect = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, selected: !q.selected } : q))
    );
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setQuestions((prev) => prev.map((q) => ({ ...q, selected: checked })));
  };

  const handleUpdateAnswerType = (id: string, type: "5mark" | "10mark" | "both") => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, answerType: type } : q))
    );
  };

  const handleSetGlobalAnswerType = (type: "5mark" | "10mark" | "both") => {
    setQuestions((prev) => prev.map((q) => ({ ...q, answerType: type })));
  };

  const handleAddManualQuestion = (text: string) => {
    const newQuestion: ExtractedQuestion = {
      id: `manual_${Math.random().toString(36).substr(2, 9)}`,
      text,
      category: "Manual Entry",
      selected: true,
      answerType: "both",
      status: "idle",
    };
    setQuestions((prev) => [...prev, newQuestion]);
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  // Inline customizations made by students
  const handleUpdateEditedText = (id: string, markType: "mark5" | "mark10", newText: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === id) {
          const target = q[markType];
          if (target) {
            return {
              ...q,
              [markType]: {
                ...target,
                userEditedText: newText,
                wordCount: newText.trim().split(/\s+/).length, // update count in real time
              },
            };
          }
        }
        return q;
      })
    );
  };

  const handleResetEditedText = (id: string, markType: "mark5" | "mark10") => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === id) {
          const target = q[markType];
          if (target) {
            return {
              ...q,
              [markType]: {
                ...target,
                userEditedText: undefined,
                wordCount: target.text.trim().split(/\s+/).length, // restore core count
              },
            };
          }
        }
        return q;
      })
    );
  };

  // 3. Compile everything to downloadable high-quality PDF
  const handleDownloadPDF = () => {
    setErrorHeader("");
    const chosenOnes = questions.filter((q) => q.selected && q.status === "completed");
    if (chosenOnes.length === 0) {
      setErrorHeader("Please process and answer some questions first before compiling PDF.");
      return;
    }

    const syllabusName = subjectModule?.name || "Syllabus Course Document";
    const qbName = questionBank?.name || "Exam Question Paper";

    try {
      generateStudyGuidePDF(syllabusName, qbName, questions);
    } catch (err: any) {
      setErrorHeader(`Error exporting file: ${err.message || err}`);
    }
  };

  const totalSelectedToProcess = questions.filter((q) => q.selected).length;
  const totalCompleted = questions.filter((q) => q.status === "completed").length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans leading-normal selection:bg-indigo-500 selection:text-white">
      
      {/* Top Header branding ribbon */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div id="app-branded-header" className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Cpu className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
                TheLastMinute-Agent
              </h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
                Academic SOS Terminal • Auto Study Guide
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
              <span className="text-xs font-semibold text-zinc-300">
                AI Agent Active: <span className="text-indigo-400">{generatingAnswers ? "Answering" : "Ready"}</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        
        {/* Bento Welcome Banner Grid Block */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-8 bg-gradient-to-br from-indigo-950/40 to-zinc-900/80 border border-indigo-500/20 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden min-h-[160px]">
            <div className="absolute right-0 top-0 h-48 w-48 bg-indigo-500/10 rounded-full filter blur-3xl -mr-16 -mt-16 pointer-events-none" />
            <div>
              <span className="text-[10px] font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-800/60 px-2.5 py-1 rounded-md uppercase tracking-wider">
                System Status // Operational
              </span>
              <h2 className="text-xl font-bold text-zinc-100 mt-3 leading-snug">
                Last-Minute Academic Accelerator
              </h2>
              <p className="text-sm text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                Feed your syllabus <strong>Subject Module</strong> and your target <strong>Question Bank</strong> to get immediate high-scoring exam guidelines. The agent auto-calibrates <strong>5-mark</strong> answers (min. 80-100 words) and robust <strong>10-mark</strong> guidelines (min. 180-200 words) from materials factually.
              </p>
            </div>
          </div>

          {/* Quick Metrics Bento Card */}
          <div className="col-span-12 md:col-span-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Study Session Summary</span>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Questions Loaded:</span>
                  <span className="font-mono text-indigo-400 font-bold">{questions.length}</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Target Selected:</span>
                  <span className="font-mono text-zinc-300 font-bold">{totalSelectedToProcess}</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Compiled Successfully:</span>
                  <span className="font-mono text-emerald-400 font-bold">{totalCompleted} / {totalSelectedToProcess}</span>
                </div>
              </div>
            </div>

            {questions.some((q) => q.status === "completed") && (
              <button
                onClick={handleDownloadPDF}
                className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-lg active:scale-[0.98] inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download Full PDF
              </button>
            )}
          </div>
        </div>

        {/* Global Notifications Panel */}
        {errorHeader && (
          <div className="flex items-start gap-3 bg-rose-950/40 border border-rose-800 text-rose-200 p-4 rounded-xl shadow-sm text-xs font-medium leading-relaxed">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
            <div className="space-y-0.5">
              <span className="block font-bold">Action Alert</span>
              <span>{errorHeader}</span>
            </div>
          </div>
        )}

        {successHeader && (
          <div className="flex items-start gap-3 bg-emerald-950/40 border border-emerald-800 text-emerald-200 p-4 rounded-xl shadow-sm text-xs font-medium leading-relaxed animate-fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
            <div className="space-y-0.5">
              <span className="block font-bold">Verified Success</span>
              <span>{successHeader}</span>
            </div>
          </div>
        )}

        {/* STEP 1: Two upload boxes in a Bento grid container */}
        <section id="step-1-uploads" className="space-y-4">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-indigo-400 shrink-0" />
            01 / Input Sourced Materials
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UploadBox
              title="Subject Module Material"
              subtitle="The reference handouts, notes, textbooks or unit lectures."
              placeholderText="Paste syllabus chapters, formulas, or key definitions here..."
              onDocLoaded={setSubjectModule}
              document={subjectModule}
            />
            <UploadBox
              title="Question Bank / Syllabus"
              subtitle="The target assignment papers or sample questionnaires."
              placeholderText="Paste course exam prompts or potential test questions to extract here..."
              onDocLoaded={setQuestionBank}
              document={questionBank}
            />
          </div>

          {/* Core scan prompt trigger */}
          {questionBank && questions.length === 0 && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleExtractQuestions}
                disabled={loadingQuestions}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm py-3 px-8 rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {loadingQuestions ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white mr-1.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Extracting Questions...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-indigo-200" />
                    Analyze and Extract Questions from Document
                  </>
                )}
              </button>
            </div>
          )}
        </section>

        {/* STEP 2: Extraction checklist & criteria */}
        {questions.length > 0 && (
          <QuestionExtractor
            questions={questions}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onUpdateAnswerType={handleUpdateAnswerType}
            onSetGlobalAnswerType={handleSetGlobalAnswerType}
            onAddManualQuestion={handleAddManualQuestion}
            onDeleteQuestion={handleDeleteQuestion}
            loading={generatingAnswers}
            onStartGeneration={handleGenerateAnswers}
          />
        )}

        {/* STEP 3: Generation Queue Monitor */}
        {generatingAnswers && (
          <section id="processing-pipeline-status" className="bg-indigo-950/20 border border-indigo-500/30 rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                <h3 className="font-bold text-xs tracking-wider text-indigo-400 uppercase">
                  ACTIVE AI PIPELINE QUEUE
                </h3>
              </div>
              <span className="text-xs text-zinc-400 font-mono">
                Running: {totalCompleted} / {totalSelectedToProcess} Done
              </span>
            </div>

            <div className="space-y-3 max-h-56 overflow-y-auto p-1 text-xs font-mono text-zinc-300">
              {questions.map((q, idx) => {
                if (!q.selected) return null;
                return (
                  <div key={q.id} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
                    <div className="flex items-center gap-2 max-w-[70%]">
                      <span className="font-bold text-zinc-500">Q{idx + 1}:</span>
                      <p className="truncate text-zinc-300">{q.text}</p>
                    </div>
                    <div>
                      {q.status === "generating" && (
                        <span className="inline-flex items-center gap-1 text-indigo-400 font-bold shrink-0">
                          <svg className="animate-spin h-3 w-3 text-indigo-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Drafting...
                        </span>
                      )}
                      {q.status === "completed" && (
                        <span className="text-emerald-400 font-bold">✓ Prepared</span>
                      )}
                      {q.status === "error" && (
                        <span className="text-rose-400 font-bold">⚠ Error: {q.error?.substring(0, 15)}</span>
                      )}
                      {q.status === "idle" && (
                        <span className="text-zinc-600">Pending</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* STEP 4: Review Panel & PDF Download option */}
        {questions.some((q) => q.status === "completed") && (
          <section id="rendering-result-workspace" className="space-y-6">
            
            {/* Main compilation bento banner */}
            <div className="bg-gradient-to-r from-indigo-950/50 to-zinc-900 border border-indigo-500/20 rounded-2xl shadow-xl p-6 text-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl shrink-0">
                  <FileCheck2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-zinc-100 leading-tight">
                    Compilation Hub Active
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1.5">
                    Click download to export a beautifully formatted exam-ready study guide including cover page and word count audit marks.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadPDF}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-all text-white font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  Download PDF Study Guide
                </button>
              </div>
            </div>

            <AnswerViewer
              questions={questions}
              onUpdateEditedText={handleUpdateEditedText}
              onResetEditedText={handleResetEditedText}
            />
          </section>
        )}

      </main>

      {/* Elegant minimalist copyright footer */}
      <footer className="border-t border-zinc-900 mt-20 py-8 bg-zinc-950 text-zinc-600 text-[10px] uppercase tracking-widest font-bold">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} TheLastMinute-Agent // LLM-powered study guides</p>
          <div className="flex gap-6 text-zinc-600">
            <span>Dynamic Word Sizers Enabled</span>
            <span>Latency: Realtime</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
