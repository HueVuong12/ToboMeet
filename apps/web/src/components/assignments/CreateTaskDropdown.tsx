import React, { useState, useRef, useEffect } from "react";
import { Plus, ChevronDown, FileText, CheckSquare } from "lucide-react";
import { useTranslations } from "next-intl";

interface CreateTaskDropdownProps {
  onSelectAssignment: () => void;
  onSelectQuiz: () => void;
  className?: string;
}

export default function CreateTaskDropdown({
  onSelectAssignment,
  onSelectQuiz,
  className = "",
}: CreateTaskDropdownProps) {
  const t = useTranslations("room.assignments_i18n");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (callback: () => void) => {
    setIsOpen(false);
    callback();
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-lg text-sm font-bold transition-all shadow-sm mr-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Plus size={16} className="shrink-0" />
        <span>{t("create_btn")}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white shadow-xl ring-1 ring-black/10 divide-y divide-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-1.5 flex flex-col gap-1">
            {/* Option 1: Tạo nhiệm vụ được giao */}
            <button
              type="button"
              onClick={() => handleSelect(onSelectAssignment)}
              className="w-full text-left flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                  {t("type_assignment")}
                </div>
                <div className="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                  {t("type_assignment_desc")}
                </div>
              </div>
            </button>

            {/* Option 2: Trắc nghiệm */}
            <button
              type="button"
              onClick={() => handleSelect(onSelectQuiz)}
              className="w-full text-left flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <CheckSquare size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-800 group-hover:text-purple-600 transition-colors">
                  {t("type_quiz")}
                </div>
                <div className="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                  {t("type_quiz_desc")}
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
