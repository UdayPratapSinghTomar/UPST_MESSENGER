function getFileType(mimeType) {
  if (!mimeType) return "file";

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";

  // PDF
  if (mimeType === "application/pdf") return "pdf";

  // Word documents
  if (
    mimeType === "application/msword" || // .doc
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" // .docx
  ) {
    return "document";
  }

  return "file";
}