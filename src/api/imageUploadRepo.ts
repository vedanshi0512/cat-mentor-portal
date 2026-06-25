import { uploadBinaryFile } from './githubClient';
import type { AppCredentials } from '@/types/auth';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB - generous for a cropped PDF screenshot, small enough to keep repo size sane

/**
 * Uploads a question image to data/images/<uuid>.<ext> in the data repo and returns
 * the repo-relative path to store on the Question record. This path later gets resolved
 * to a real raw.githubusercontent.com URL at render time (see src/utils/imageUrl.ts) -
 * we store the relative path, not a full URL, so it keeps working even if the repo is
 * later renamed or moved (only the resolver needs updating, not every question).
 */
export async function uploadQuestionImage(
  creds: AppCredentials,
  file: File
): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Image is too large (${Math.round(file.size / 1024 / 1024 * 10) / 10}MB). Please keep images under 3MB - try cropping tighter or re-exporting at a lower resolution.`);
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('That file does not look like an image. Please choose a PNG, JPG, or similar image file.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `data/images/${filename}`;

  await uploadBinaryFile(creds, path, bytes, `Add question image ${filename}`);
  return path;
}
