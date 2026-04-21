exports.getPublicFileUrl = (filePath) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const BUCKET = 'task-attachments';

  if (!filePath) return null;

  return `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${filePath}`;
};