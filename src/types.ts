export interface InputDocument {
  name: string;
  size: number;
  type: "pdf" | "text";
  content?: string; // If pasted/text type
  base64?: string; // If pdf upload
}

export interface AnswerItem {
  text: string;
  wordCount: number;
  userEditedText?: string; // For manual overrides by the student
}

export interface ExtractedQuestion {
  id: string;
  text: string;
  category: string;
  selected: boolean;
  answerType: "5mark" | "10mark" | "both";
  
  // Status of the single answer generation block
  status: "idle" | "generating" | "completed" | "error";
  error?: string;
  
  // Answers returned from Gemini
  mark5?: AnswerItem;
  mark10?: AnswerItem;
}
