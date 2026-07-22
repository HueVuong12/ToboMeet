"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Loader2, Bold, Italic, Underline, List, ListOrdered, Smile, Paperclip, Image as ImageIcon, Video as VideoIcon, FileText, AlertCircle, RefreshCw } from "lucide-react";
import { useGetRoomMembersQuery } from "@/lib/redux/api/roomsApi";
import { useGetSignedUploadUrlMutation } from "@/lib/redux/api/newsFeedApi";
import axios from "axios";
import { useTranslations } from "next-intl";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  channelId: string;
  onSuccess: (post: any) => void;
  // Cho phép edit bài viết hiện tại
  editPostData?: {
    id: string;
    content: string;
    attachments: any[];
  } | null;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "success" | "error";
  url?: string;
  fileName?: string;
  fileType: "image" | "video" | "file";
  errorMsg?: string;
}

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🎉", "🔥", "🚀", "💡", "💯", "❌"];

export default function CreatePostModal({
  isOpen,
  onClose,
  roomId,
  channelId,
  onSuccess,
  editPostData,
}: CreatePostModalProps) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const t = useTranslations("news_feed");

  // Mention @ States
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(-1);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: members = [] } = useGetRoomMembersQuery(roomId, { skip: !isOpen });
  const [getSignedUrl] = useGetSignedUploadUrlMutation();

  // Populate data if in edit mode
  useEffect(() => {
    if (isOpen) {
      if (editPostData) {
        setContent(editPostData.content);
        setFiles(
          editPostData.attachments.map((att, idx) => ({
            id: `edit-${idx}`,
            file: new File([], att.fileName), // Empty file mock for already uploaded attachments
            progress: 100,
            status: "success",
            url: att.url,
            fileName: att.fileName,
            fileType: att.fileType,
          }))
        );
      } else {
        setContent("");
        setFiles([]);
      }
      setValidationError(null);
      setShowEmojiPicker(false);
      setShowMentionDropdown(false);
    }
  }, [isOpen, editPostData]);

  if (!isOpen) return null;

  // Insert markdown tag or text at cursor
  const insertText = (before: string, after: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const replacement = before + selectedText + after;
    const newContent = text.substring(0, start) + replacement + text.substring(end);
    setContent(newContent);
    setShowEmojiPicker(false);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selectedText.length
      );
    }, 0);
  };

  const insertNumberedList = () => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart || content.length;
    const textBefore = content.substring(0, start);
    const lines = textBefore.split("\n");
    let lastNum = 0;

    for (let i = lines.length - 1; i >= 0; i--) {
      const match = lines[i].match(/^\s*(\d+)\.\s/);
      if (match) {
        lastNum = parseInt(match[1], 10);
        break;
      }
    }

    const nextNum = lastNum + 1;
    const prefix = textBefore.endsWith("\n") || textBefore.length === 0 ? "" : "\n";
    insertText(`${prefix}${nextNum}. `);
  };

  // Handle Mention Trigger
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    const selectionStart = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, selectionStart);
    const lastAtPos = textBeforeCursor.lastIndexOf("@");

    // Hiển thị dropdown nhắc tên nếu gõ @ đứng sau khoảng trắng hoặc ở đầu dòng
    if (lastAtPos !== -1 && (lastAtPos === 0 || textBeforeCursor[lastAtPos - 1] === " " || textBeforeCursor[lastAtPos - 1] === "\n")) {
      const query = textBeforeCursor.substring(lastAtPos + 1);
      if (!query.includes(" ")) {
        setMentionQuery(query);
        setMentionIndex(lastAtPos);
        setShowMentionDropdown(true);
        return;
      }
    }
    setShowMentionDropdown(false);
  };

  const selectMention = (member: any) => {
    const before = content.substring(0, mentionIndex);
    const after = content.substring(textareaRef.current?.selectionStart || 0);
    const insert = `@${member.displayName} `;
    setContent(before + insert + after);
    setShowMentionDropdown(false);
    textareaRef.current?.focus();
  };

  // Filter members for mention
  const filteredMembers = members.filter((m: any) =>
    m.displayName?.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  // File Upload Handling
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const isImage = [".jpg", ".png", ".jpeg", ".webp"].includes(ext);
    const isVideo = [".mp4", ".mov", ".avi"].includes(ext);
    const isDoc = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".zip", ".rar"].includes(ext);

    if (!isImage && !isVideo && !isDoc) {
      return { valid: false, error: `Tệp "${file.name}" không đúng định dạng cho phép.` };
    }

    if (isImage && file.size > 20 * 1024 * 1024) {
      return { valid: false, error: `Ảnh "${file.name}" vượt quá giới hạn 20MB.` };
    }
    if (isVideo && file.size > 500 * 1024 * 1024) {
      return { valid: false, error: `Video "${file.name}" vượt quá giới hạn 500MB.` };
    }
    if (isDoc && file.size > 100 * 1024 * 1024) {
      return { valid: false, error: `Tài liệu "${file.name}" vượt quá giới hạn 100MB.` };
    }

    return { valid: true };
  };

  const startUpload = async (fileObj: UploadingFile) => {
    // Nếu mock file (đã upload trước đó ở chế độ Edit)
    if (fileObj.file.size === 0) return;

    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileObj.id
          ? { ...f, status: "uploading", progress: 0, errorMsg: undefined }
          : f
      )
    );

    try {
      // 1. Lấy Signed Upload URL từ server
      const { signedUrl, url, fileName } = await getSignedUrl({
        fileName: fileObj.file.name,
      }).unwrap();

      // 2. Upload trực tiếp lên Supabase
      await axios.put(signedUrl, fileObj.file, {
        headers: {
          "Content-Type": fileObj.file.type || "application/octet-stream",
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setFiles((prev) =>
              prev.map((f) => (f.id === fileObj.id ? { ...f, progress } : f))
            );
          }
        },
      });

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileObj.id
            ? { ...f, status: "success", progress: 100, url, fileName }
            : f
        )
      );
    } catch (err: any) {
      console.error("Upload error:", err);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileObj.id
            ? { ...f, status: "error", errorMsg: err?.message || "Tải lên thất bại." }
            : f
        )
      );
    }
  };

  const handleFilesInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
  };

  const addFiles = (fileList: FileList) => {
    setValidationError(null);

    if (files.length + fileList.length > 10) {
      setValidationError(t("max_files_error"));
      return;
    }

    const newFiles: UploadingFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const validation = validateFile(file);

      if (!validation.valid) {
        setValidationError(validation.error || "Tệp không hợp lệ");
        return;
      }

      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      let fileType: "image" | "video" | "file" = "file";
      if ([".jpg", ".png", ".jpeg", ".webp"].includes(ext)) fileType = "image";
      else if ([".mp4", ".mov", ".avi"].includes(ext)) fileType = "video";

      const fileObj: UploadingFile = {
        id: Math.random().toString(36).substring(2, 9),
        file,
        progress: 0,
        status: "uploading",
        fileType,
      };

      newFiles.push(fileObj);
    }

    setFiles((prev) => [...prev, ...newFiles]);

    // Trực tiếp upload
    newFiles.forEach((fileObj) => startUpload(fileObj));
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const retryUpload = (fileObj: UploadingFile) => {
    startUpload(fileObj);
  };

  // Drag and Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      addFiles(e.dataTransfer.files);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const isUploading = files.some((f) => f.status === "uploading");
    if (isUploading) {
      setValidationError(t("wait_upload_error"));
      return;
    }

    const hasUploadErrors = files.some((f) => f.status === "error");
    if (hasUploadErrors) {
      setValidationError(t("upload_error_retry"));
      return;
    }

    if (!content.trim() && files.length === 0) {
      setValidationError(t("content_required_error"));
      return;
    }

    setIsSubmitting(true);

    try {
      const attachments = files.map((f) => ({
        url: f.url!,
        fileName: f.fileName || f.file.name,
        fileType: f.fileType,
        fileSize: f.file.size || 0,
      }));

      onSuccess({
        content: content.trim(),
        attachments,
      });
      onClose();
    } catch (err: any) {
      setValidationError(err?.message || t("failed_create_post"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={() => !isSubmitting && onClose()} />

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col z-10 transition-all border duration-200 overflow-hidden ${
          dragActive ? "border-brand-500 bg-brand-50/10 scale-[0.99]" : "border-slate-200"
        }`}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-slate-800">
            {editPostData ? t("edit_post_title") : t("new_post_title")}
          </h3>
          <button
            disabled={isSubmitting}
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded text-slate-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto max-h-[80vh] p-6 space-y-4">
          {/* Main Input Textarea */}
          <div className="relative flex-1 min-h-[140px]">
            <textarea
              ref={textareaRef}
              rows={5}
              placeholder={t("comment_placeholder")}
              value={content}
              onChange={handleTextareaChange}
              disabled={isSubmitting}
              className="w-full h-full text-sm text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none resize-none"
            />

            {/* Mention Dropdown */}
            {showMentionDropdown && filteredMembers.length > 0 && (
              <div className="absolute left-0 bottom-full mb-1 z-30 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto w-48">
                {filteredMembers.map((m: any) => (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => selectMention(m)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                  >
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px]">
                        {m.displayName?.charAt(0)}
                      </div>
                    )}
                    <span className="font-semibold truncate">{m.displayName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Validation Error Alert */}
          {validationError && (
            <div className="flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 p-3 rounded-xl">
              <AlertCircle size={16} className="shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Upload Attachments Preview List */}
          {files.length > 0 && (
            <div className="grid grid-cols-2 gap-3 pb-2">
              {files.map((fileObj) => (
                <div
                  key={fileObj.id}
                  className="relative group border border-slate-100 rounded-xl p-2.5 bg-slate-50 flex items-center gap-2.5 overflow-hidden"
                >
                  {/* File Type Icon */}
                  <div className="w-9 h-9 flex items-center justify-center bg-white border border-slate-100 rounded-lg shrink-0 text-slate-500">
                    {fileObj.fileType === "image" ? (
                      <ImageIcon size={18} />
                    ) : fileObj.fileType === "video" ? (
                      <VideoIcon size={18} />
                    ) : (
                      <FileText size={18} />
                    )}
                  </div>

                  {/* File Info & Upload Status */}
                  <div className="flex-1 min-w-0 pr-6 text-left">
                    <p className="text-xs font-semibold text-slate-700 truncate">
                      {fileObj.fileName || fileObj.file.name}
                    </p>
                    {fileObj.status === "uploading" && (
                      <div className="mt-1 w-full">
                        <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="bg-brand-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${fileObj.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5 inline-block">
                          Đang tải lên ({fileObj.progress}%)
                        </span>
                      </div>
                    )}
                    {fileObj.status === "success" && (
                      <span className="text-[10px] text-emerald-600 font-medium">{t("upload_success")}</span>
                    )}
                    {fileObj.status === "error" && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-red-500 font-medium truncate">
                          {t("upload_failed")}
                        </span>
                        <button
                          type="button"
                          onClick={() => retryUpload(fileObj)}
                          title="Tải lại file"
                          className="p-0.5 text-slate-500 hover:text-brand-600 rounded"
                        >
                          <RefreshCw size={10} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeFile(fileObj.id)}
                    className="absolute top-2.5 right-2.5 p-1 bg-white border border-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full shadow-sm transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Form Bottom Bar - Rich Text Toolbar & Upload Buttons */}
          <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-3 bg-white">
            {/* Rich Text Options */}
            <div className="flex items-center gap-0.5 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => insertText("**", "**")}
                title={t("bold")}
                className="p-1.5 hover:bg-white hover:shadow-sm text-slate-600 rounded"
              >
                <Bold size={16} />
              </button>
              <button
                type="button"
                onClick={() => insertText("*", "*")}
                title={t("italic")}
                className="p-1.5 hover:bg-white hover:shadow-sm text-slate-600 rounded"
              >
                <Italic size={16} />
              </button>
              <button
                type="button"
                onClick={() => insertText("__", "__")}
                title={t("underline")}
                className="p-1.5 hover:bg-white hover:shadow-sm text-slate-600 rounded"
              >
                <Underline size={16} />
              </button>
              <div className="h-4 w-[1px] bg-slate-200 mx-1" />
              <button
                type="button"
                onClick={() => insertText("\n- ")}
                title={t("list")}
                className="p-1.5 hover:bg-white hover:shadow-sm text-slate-600 rounded"
              >
                <List size={16} />
              </button>
              <button
                type="button"
                onClick={insertNumberedList}
                title={t("ordered_list")}
                className="p-1.5 hover:bg-white hover:shadow-sm text-slate-600 rounded"
              >
                <ListOrdered size={16} />
              </button>
              <div className="h-4 w-[1px] bg-slate-200 mx-1" />
              
              {/* Emojis Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  title={t("add_emoji")}
                  className={`p-1.5 rounded transition-colors ${showEmojiPicker ? "bg-white shadow-sm text-brand-600" : "hover:bg-white hover:shadow-sm text-slate-600"}`}
                >
                  <Smile size={16} />
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-full left-0 mb-2 p-2 bg-white border border-slate-200 rounded-xl shadow-xl grid grid-cols-6 gap-1 w-44 z-30">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertText(emoji)}
                        className="w-6 h-6 flex items-center justify-center text-sm hover:bg-slate-100 rounded"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Media Attachment Actions */}
            <div className="flex items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFilesInput}
                className="hidden"
                accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={t("attach_files")}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
              >
                <Paperclip size={14} />
                <span>{t("attach_files")}</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>{t("saving")}</span>
                  </>
                ) : (
                  <span>{t("post_button")}</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
