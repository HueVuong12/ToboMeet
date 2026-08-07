"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { axiosInstance } from "@/lib/axios";
import axios from "axios";
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  Check,
  List as ListIcon,
  ListOrdered as ListOrderedIcon,
  Heading1,
  Heading2,
  Quote as QuoteIcon,
  Link2 as LinkIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Paperclip as PaperclipIcon,
  Image as ImageIcon,
  Smile as SmileIcon,
  ChevronDown,
  Trash2,
  FileText,
  AlertCircle,
  Type,
  Palette
} from "lucide-react";

interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
}

interface TeamsRichEditorProps {
  value: string;
  onChange: (html: string) => void;
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  initialAttachments?: Attachment[];
  locale?: string;
  placeholder?: string;
  resetKey?: number;
}

// Popular Emojis List
const EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰",
  "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏",
  "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠",
  "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥",
  "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐",
  "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "🤡", "💩", "👻",
  "💀", "☠️", "👽", "👾", "🤖", "🎃", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "👋",
  "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕",
  "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅",
  "🤳", "💪", "🦾", "💪", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️", "👅", "👄"
];

function ImageNodeView(props: any) {
  const { node, deleteNode } = props;
  const { src } = node.attrs;

  return (
    <NodeViewWrapper className="relative inline-block my-2 mr-2 select-none group align-middle">
      <div className="relative w-36 h-36 overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-slate-50">
        <img src={src} className="w-full h-full object-cover" alt="" />
        
        {/* Dấu tích xanh ở góc trên bên trái */}
        <div className="absolute top-2 left-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-md z-10">
          <Check className="w-3 h-3 stroke-[3]" />
        </div>

        {/* Nút xóa ở góc trên bên phải */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteNode();
          }}
          className="absolute top-2 right-2 w-7 h-7 bg-white hover:bg-slate-50 rounded-full flex items-center justify-center text-slate-500 hover:text-red-500 shadow-md border border-slate-100 transition-all duration-200 cursor-pointer active:scale-95 z-10"
          title="Xóa hình ảnh"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </NodeViewWrapper>
  );
}

const CustomImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

export default function TeamsRichEditor({
  value,
  onChange,
  onAttachmentsChange,
  initialAttachments = [],
  locale = "vi",
  placeholder = "Nội dung tóm tắt cuộc họp...",
  resetKey = 0
}: TeamsRichEditorProps) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [isFormatVisible, setIsFormatVisible] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [textColor, setTextColor] = useState("#000000");
  const [textHighlight, setTextHighlight] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetPos, setDeleteTargetPos] = useState<number | null>(null);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const [updateTick, setUpdateTick] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<any>(null);

  // Clean up timeout ref on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const updatePickerPosition = () => {
    if (emojiButtonRef.current) {
      const rect = emojiButtonRef.current.getBoundingClientRect();
      const pickerHeight = 220; // approximate height of picker dialog
      const pickerWidth = 256;  // approximate width of picker dialog
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top = rect.bottom;
      // Default to opening above if space below is not enough
      if (spaceBelow < pickerHeight && spaceAbove > pickerHeight) {
        top = rect.top - pickerHeight - 4;
      } else {
        top = rect.bottom + 4;
      }

      let left = rect.left;
      // Prevent picker from going off-screen to the right
      if (left + pickerWidth > window.innerWidth) {
        left = window.innerWidth - pickerWidth - 16;
      }
      if (left < 16) {
        left = 16;
      }

      setPickerPosition({ top, left });
    }
  };

  useEffect(() => {
    if (isEmojiPickerOpen) {
      updatePickerPosition();
      // Listen to scroll and resize events globally
      window.addEventListener("scroll", updatePickerPosition, true);
      window.addEventListener("resize", updatePickerPosition);
    }
    return () => {
      window.removeEventListener("scroll", updatePickerPosition, true);
      window.removeEventListener("resize", updatePickerPosition);
    };
  }, [isEmojiPickerOpen]);

  // Helper to extract attachments from HTML
  const extractAttachments = (htmlString: string) => {
    if (!htmlString) return { cleanHtml: "", files: [] };
    const match = htmlString.match(/<div[^>]*data-attachments="([^"]*)"[^>]*><\/div>/);
    if (match) {
      try {
        const decoded = decodeURIComponent(match[1]);
        const files = JSON.parse(decoded);
        const cleanHtml = htmlString.replace(match[0], "");
        return { cleanHtml, files };
      } catch (e) {
        console.error("Lỗi parse data-attachments:", e);
      }
    }
    return { cleanHtml: htmlString, files: [] };
  };

  // Helper to combine HTML and attachments
  const combineHtmlAndAttachments = (htmlString: string, fileList: Attachment[]) => {
    let clean = htmlString;
    // Strip any existing attachments div first
    const match = htmlString.match(/<div[^>]*data-attachments="([^"]*)"[^>]*><\/div>/);
    if (match) {
      clean = htmlString.replace(match[0], "");
    }
    if (fileList.length === 0) return clean;
    return `${clean}<div data-attachments="${encodeURIComponent(JSON.stringify(fileList))}"></div>`;
  };

  // Initialize Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure(),
      Placeholder.configure({
        placeholder,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-indigo-600 underline cursor-pointer",
        },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      CustomImage,
    ],
    content: extractAttachments(value).cleanHtml || "",
    editorProps: {
      attributes: {
        class: "outline-none min-h-[150px] w-full h-full prose prose-slate max-w-none text-base cursor-text",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const combined = combineHtmlAndAttachments(html, attachments);
      
      // Save Draft
      localStorage.setItem("teams_rich_editor_draft_content", combined);

      // Debounce notifying parent page
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        onChange(combined);
      }, 300);
    },
    onBlur: ({ editor }) => {
      const html = editor.getHTML();
      const combined = combineHtmlAndAttachments(html, attachments);
      onChange(combined);
    },
    onTransaction: () => {
      setUpdateTick((prev) => prev + 1);
    },
  });

  // Load Draft from LocalStorage on Mount (if value is empty)
  useEffect(() => {
    if (editor && !value) {
      const savedContent = localStorage.getItem("teams_rich_editor_draft_content");
      if (savedContent) {
        const { cleanHtml, files } = extractAttachments(savedContent);
        editor.commands.setContent(cleanHtml);
        setAttachments(files);
        onChange(savedContent);
      }
    } else if (editor && value && !editor.isFocused) {
      // Sync editor content if external value changes (like when loading an existing event for editing)
      const { cleanHtml, files } = extractAttachments(value);
      if (cleanHtml !== editor.getHTML()) {
        editor.commands.setContent(cleanHtml);
      }
      if (JSON.stringify(files) !== JSON.stringify(attachments)) {
        setAttachments(files);
      }
    }
  }, [editor, value]);

  // Reset content when resetKey changes
  useEffect(() => {
    if (editor && resetKey > 0) {
      editor.commands.setContent("");
      setAttachments([]);
    }
  }, [resetKey, editor]);

  // Sync attachments to draft
  useEffect(() => {
    if (editor) {
      const currentHtml = editor.getHTML();
      const combined = combineHtmlAndAttachments(currentHtml, attachments);
      onChange(combined);
      localStorage.setItem("teams_rich_editor_draft_content", combined);
    }
  }, [attachments]);

  // Close Popups on Click Outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node) &&
          emojiButtonRef.current && !emojiButtonRef.current.contains(event.target as Node)) {
        setIsEmojiPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!editor) return null;

  // Character validation
  const plainText = editor.getText();
  const charCount = plainText.length;
  const isOverLimit = charCount > 10000;

  // Handle file uploads (API request to get signed url and upload)
  const handleUploadFile = async (file: File, isInlineImage = false) => {
    setIsUploading(true);
    setUploadProgress(10);
    try {
      // Step 1: Request signed upload url
      const { signedUrl, url, fileName } = await axiosInstance.post<any, {
        signedUrl: string;
        url: string;
        fileName: string;
      }>("/uploads/calendar-assets/signed-url", {
        fileName: file.name,
        mimeType: file.type,
      });
      setUploadProgress(40);

      // Step 2: PUT file directly to Supabase storage
      await axios.put(signedUrl, file, {
        headers: { "Content-Type": file.type },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = 40 + Math.round((progressEvent.loaded * 50) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });
      setUploadProgress(95);

      if (isInlineImage) {
        // Insert Image into Editor content
        editor.chain().focus().setImage({ src: url }).run();
      } else {
        // Add to attachments list
        const newAttachment: Attachment = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: file.name,
          url,
          size: file.size,
          type: file.type,
        };
        setAttachments((prev) => [...prev, newAttachment]);
      }
    } catch (error: any) {
      console.error("Lỗi upload file:", error);
      alert(locale === "vi" ? `Không thể tải tệp lên: ${error.response?.data?.message || error.message}` : `Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach((file) => {
        handleUploadFile(file, false);
      });
    }
  };

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUploadFile(e.target.files[0], true);
    }
  };

  // Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach((file) => {
        const isImage = file.type.startsWith("image/");
        handleUploadFile(file, isImage);
      });
    }
  };

  // Paste from clipboard (images)
  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      Array.from(e.clipboardData.files).forEach((file) => {
        const isImage = file.type.startsWith("image/");
        handleUploadFile(file, isImage);
      });
    }
  };

  // Insert Emoji at selection
  const insertEmoji = (emoji: string) => {
    editor.chain().focus().insertContent(emoji).run();
    setIsEmojiPickerOpen(false);
  };

  const handleEmojiClick = () => {
    if (!isEmojiPickerOpen) {
      updatePickerPosition();
    }
    setIsEmojiPickerOpen(!isEmojiPickerOpen);
  };

  // Remove file
  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const triggerLinkPrompt = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt(locale === "vi" ? "Nhập địa chỉ liên kết:" : "Enter URL:", previousUrl);

    if (url === null) {
      return;
    }

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div
      className="flex flex-col border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 rounded-xl transition-all overflow-visible relative bg-white"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Editor Content Area */}
      <div 
        className="flex-1 min-h-[150px] max-h-[300px] overflow-y-auto p-4 cursor-text rounded-t-[11px]" 
        onPaste={handlePaste}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            editor.chain().focus().run();
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Uploading progress bar */}
      {isUploading && (
        <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>{locale === "vi" ? "Đang tải tệp lên..." : "Uploading file..."}</span>
          <div className="flex items-center gap-2 w-32">
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
            </div>
            <span>{uploadProgress}%</span>
          </div>
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2">
          {attachments.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-sm text-xs max-w-[200px]"
            >
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex-1 overflow-hidden">
                <p className="font-medium text-slate-700 truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                type="button"
                onClick={() => removeAttachment(file.id)}
                className="p-1 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Main Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-100 shrink-0 rounded-b-[11px]">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none mobile-scroll-x">
          {/* File Attach Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileChange}
            multiple
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shrink-0"
            title="Đính kèm tệp"
          >
            <PaperclipIcon className="w-4.5 h-4.5" />
          </button>



          {/* Inline Image Input */}
          <input
            type="file"
            ref={imageInputRef}
            onChange={onImageChange}
            className="hidden"
            accept="image/*"
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shrink-0"
            title="Chèn hình ảnh"
          >
            <ImageIcon className="w-4.5 h-4.5" />
          </button>

          {/* Emoji Picker Trigger */}
          <div className="relative">
            <button
              ref={emojiButtonRef}
              type="button"
              onClick={handleEmojiClick}
              className={`p-2 rounded-lg transition-colors shrink-0 ${isEmojiPickerOpen ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"}`}
              title="Emoji"
            >
              <SmileIcon className="w-4.5 h-4.5" />
            </button>

            {isEmojiPickerOpen && (pickerPosition.top !== 0 || pickerPosition.left !== 0) && typeof document !== "undefined" && createPortal(
              <div 
                ref={emojiPickerRef}
                style={{
                  position: "fixed",
                  top: `${pickerPosition.top}px`,
                  left: `${pickerPosition.left}px`,
                  width: "256px",
                  zIndex: 99999,
                }}
                className="bg-white border border-slate-200 rounded-xl shadow-lg p-2 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto p-1 scrollbar-thin">
                  {EMOJIS.map((emoji, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="w-7 h-7 text-lg hover:bg-slate-100 rounded flex items-center justify-center transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>,
              document.body
            )}
          </div>

          {/* Toggle Format Toolbar */}
          <button
            type="button"
            onClick={() => setIsFormatVisible(!isFormatVisible)}
            className={`p-2 rounded-lg transition-colors shrink-0 ${isFormatVisible ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"}`}
            title="Định dạng nâng cao"
          >
            <Type className="w-4.5 h-4.5" />
          </button>

          {/* Formatting Buttons (Inside bottom toolbar) */}
          {isFormatVisible && (
            <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded-lg transition-colors hover:bg-slate-200 shrink-0 ${editor.isActive("bold") ? "bg-slate-200 text-indigo-600" : "text-slate-600"}`}
                title="In đậm (Ctrl+B)"
              >
                <BoldIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded-lg transition-colors hover:bg-slate-200 shrink-0 ${editor.isActive("italic") ? "bg-slate-200 text-indigo-600" : "text-slate-600"}`}
                title="In nghiêng (Ctrl+I)"
              >
                <ItalicIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-1.5 rounded-lg transition-colors hover:bg-slate-200 shrink-0 ${editor.isActive("underline") ? "bg-slate-200 text-indigo-600" : "text-slate-600"}`}
                title="Gạch chân (Ctrl+U)"
              >
                <UnderlineIcon className="w-4 h-4" />
              </button>

              <span className="w-[1px] h-4 bg-slate-200 mx-1 shrink-0"></span>

              <button
                type="button"
                onClick={() => {
                  if (!editor) return;
                  const { state } = editor.view;
                  const { selection } = state;
                  const { $from, $to } = selection;
                  const range = $from.blockRange($to, node => node.type.name === 'bulletList' || node.type.name === 'orderedList');
                  if (range) {
                    const isSelectingAll = range.startIndex === 0 && range.endIndex === range.parent.childCount;
                    if (!isSelectingAll) {
                      editor.chain().focus().liftListItem('listItem').wrapIn('bulletList').run();
                      return;
                    }
                  }
                  editor.chain().focus().toggleBulletList().run();
                }}
                className={`p-1.5 rounded-lg transition-colors hover:bg-slate-200 shrink-0 ${editor.isActive("bulletList") ? "bg-slate-200 text-indigo-600" : "text-slate-600"}`}
                title="Danh sách dấu đầu dòng"
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editor) return;
                  const { state } = editor.view;
                  const { selection } = state;
                  const { $from, $to } = selection;
                  const range = $from.blockRange($to, node => node.type.name === 'bulletList' || node.type.name === 'orderedList');
                  if (range) {
                    const isSelectingAll = range.startIndex === 0 && range.endIndex === range.parent.childCount;
                    if (!isSelectingAll) {
                      editor.chain().focus().liftListItem('listItem').wrapIn('orderedList').run();
                      return;
                    }
                  }
                  editor.chain().focus().toggleOrderedList().run();
                }}
                className={`p-1.5 rounded-lg transition-colors hover:bg-slate-200 shrink-0 ${editor.isActive("orderedList") ? "bg-slate-200 text-indigo-600" : "text-slate-600"}`}
                title="Danh sách số"
              >
                <ListOrderedIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Character Count Warnings */}
        {charCount >= 10000 && (
          <div className="text-xs text-red-500 font-semibold flex items-center gap-1 animate-pulse">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>
              {locale === "vi" 
                ? "Nội dung mô tả không được vượt quá 10.000 ký tự" 
                : "You can only type up to 10,000 characters"}
            </span>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div 
          onClick={() => {
            setShowDeleteConfirm(false);
            setDeleteTargetPos(null);
          }}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-7 max-w-md w-full shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
          >
            <h3 className="font-bold text-slate-800 text-lg mb-3">
              {locale === "vi" ? "Xác nhận xóa" : "Confirm Delete"}
            </h3>
            <p className="text-sm text-slate-500 mb-7 leading-relaxed">
              {locale === "vi" 
                ? "Bạn có chắc chắn muốn xóa hình ảnh này khỏi nội dung mô tả?" 
                : "Are you sure you want to remove this image from the description?"}
            </p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteTargetPos(null);
                }}
                className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
              >
                {locale === "vi" ? "Hủy" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteTargetPos !== null && editor) {
                    editor.view.dispatch(editor.state.tr.delete(deleteTargetPos, deleteTargetPos + 1));
                  }
                  setShowDeleteConfirm(false);
                  setDeleteTargetPos(null);
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
              >
                {locale === "vi" ? "Xóa" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline SVG / Wrapper for highlight icon
function HighlightIconWrapper({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 11-6 6v3h9l3-3" />
      <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
    </svg>
  );
}
