import React from "react";
import { Text, TextStyle } from "react-native";

/**
 * Trình biên dịch Markdown / HTML cho React Native.
 * Hỗ trợ:
 * - **bold** (In đậm)
 * - *italic* (In nghiêng)
 * - <u>underline</u> (Gạch chân)
 * - Danh sách số (1. 2. 3.) & gạch đầu dòng (- )
 */
export function renderFormattedText(text: string, baseStyle?: TextStyle) {
  if (!text) return null;

  const lines = text.split("\n");

  return lines.map((line, lineIdx) => {
    let prefix: React.ReactNode = null;
    let lineContent = line;

    // Check for Bullet List (- item)
    if (lineContent.startsWith("- ")) {
      prefix = <Text style={[{ fontWeight: "bold" }, baseStyle]}>• </Text>;
      lineContent = lineContent.substring(2);
    }
    // Check for Numbered List (1. item, 2. item...)
    else {
      const numMatch = lineContent.match(/^(\d+\.)\s/);
      if (numMatch) {
        prefix = <Text style={[{ fontWeight: "bold" }, baseStyle]}>{numMatch[1]} </Text>;
        lineContent = lineContent.substring(numMatch[0].length);
      }
    }

    const pattern = /(<u>[\s\S]*?<\/u>|\*\*[\s\S]*?\*\*|\*[\s\S]*?\*)/g;
    const parts = lineContent.split(pattern);

    const formattedParts = parts.map((part, index) => {
      if (!part) return null;

      let isBold = false;
      let isItalic = false;
      let isUnderline = false;
      let cleanText = part;

      if (cleanText.startsWith("<u>") && cleanText.endsWith("</u>")) {
        isUnderline = true;
        cleanText = cleanText.substring(3, cleanText.length - 4);
      }

      if (cleanText.startsWith("**") && cleanText.endsWith("**") && cleanText.length >= 4) {
        isBold = true;
        cleanText = cleanText.substring(2, cleanText.length - 2);
      }

      if (cleanText.startsWith("*") && cleanText.endsWith("*") && cleanText.length >= 2) {
        isItalic = true;
        cleanText = cleanText.substring(1, cleanText.length - 1);
      }

      if (cleanText.startsWith("**") && cleanText.endsWith("**") && cleanText.length >= 4) {
        isBold = true;
        cleanText = cleanText.substring(2, cleanText.length - 2);
      }
      if (cleanText.startsWith("*") && cleanText.endsWith("*") && cleanText.length >= 2) {
        isItalic = true;
        cleanText = cleanText.substring(1, cleanText.length - 1);
      }

      const style: TextStyle = {
        ...(baseStyle || {}),
        fontWeight: isBold ? "bold" : baseStyle?.fontWeight || "normal",
        fontStyle: isItalic ? "italic" : baseStyle?.fontStyle || "normal",
        textDecorationLine: isUnderline ? "underline" : baseStyle?.textDecorationLine || "none",
      };

      return (
        <Text key={index} style={style}>
          {cleanText}
        </Text>
      );
    });

    return (
      <Text key={lineIdx}>
        {prefix}
        {formattedParts}
        {lineIdx < lines.length - 1 ? "\n" : ""}
      </Text>
    );
  });
}
