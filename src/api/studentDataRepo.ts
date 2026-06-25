import { getJsonFile } from './githubClient';
import { updateJsonFileWithRetry } from './optimisticUpdate';
import type { AppCredentials } from '@/types/auth';
import type { Bookmark, BookmarkFolder, BookmarksFile, Note, NotesFile, CustomTag, TagsFile } from '@/types/student';

function bookmarksPath(studentId: string) {
  return `student-data/${studentId}/bookmarks.json`;
}
function notesPath(studentId: string) {
  return `student-data/${studentId}/notes.json`;
}
function tagsPath(studentId: string) {
  return `student-data/${studentId}/tags.json`;
}

const DEFAULT_FOLDERS: BookmarkFolder[] = [
  { id: 'revision', name: 'Revision', createdAt: new Date(0).toISOString() },
  { id: 'mistakes', name: 'Mistakes', createdAt: new Date(0).toISOString() },
  { id: 'reattempt', name: 'Reattempt', createdAt: new Date(0).toISOString() },
];

function defaultBookmarksFile(): BookmarksFile {
  return { version: 1, folders: structuredClone(DEFAULT_FOLDERS), bookmarks: [] };
}

// ---------- Bookmarks ----------

export async function fetchBookmarks(creds: AppCredentials, studentId: string): Promise<BookmarksFile> {
  const result = await getJsonFile<BookmarksFile>(creds, bookmarksPath(studentId));
  return result?.data ?? defaultBookmarksFile();
}

export async function addBookmark(creds: AppCredentials, studentId: string, bookmark: Bookmark): Promise<BookmarksFile> {
  return updateJsonFileWithRetry(
    creds,
    bookmarksPath(studentId),
    defaultBookmarksFile(),
    (current) => ({ ...current, bookmarks: [...current.bookmarks, bookmark] }),
    `Bookmark question ${bookmark.questionId}`
  );
}

export async function removeBookmark(creds: AppCredentials, studentId: string, bookmarkId: string): Promise<BookmarksFile> {
  return updateJsonFileWithRetry(
    creds,
    bookmarksPath(studentId),
    defaultBookmarksFile(),
    (current) => ({ ...current, bookmarks: current.bookmarks.filter((b) => b.id !== bookmarkId) }),
    `Remove bookmark ${bookmarkId}`
  );
}

export async function addBookmarkFolder(creds: AppCredentials, studentId: string, folder: BookmarkFolder): Promise<BookmarksFile> {
  return updateJsonFileWithRetry(
    creds,
    bookmarksPath(studentId),
    defaultBookmarksFile(),
    (current) => ({ ...current, folders: [...current.folders, folder] }),
    `Add bookmark folder "${folder.name}"`
  );
}

// ---------- Notes ----------

function defaultNotesFile(): NotesFile {
  return { version: 1, notes: [] };
}

export async function fetchNotes(creds: AppCredentials, studentId: string): Promise<Note[]> {
  const result = await getJsonFile<NotesFile>(creds, notesPath(studentId));
  return result?.data.notes ?? [];
}

export async function upsertNote(creds: AppCredentials, studentId: string, note: Note): Promise<Note[]> {
  const result = await updateJsonFileWithRetry(
    creds,
    notesPath(studentId),
    defaultNotesFile(),
    (current) => {
      const next = structuredClone(current);
      const idx = next.notes.findIndex((n) => n.id === note.id);
      if (idx >= 0) next.notes[idx] = note;
      else next.notes.push(note);
      return next;
    },
    `Save note on question ${note.questionId}`
  );
  return result.notes;
}

// ---------- Custom tags ----------

function defaultTagsFile(): TagsFile {
  return { version: 1, tags: [] };
}

export async function fetchCustomTags(creds: AppCredentials, studentId: string): Promise<CustomTag[]> {
  const result = await getJsonFile<TagsFile>(creds, tagsPath(studentId));
  return result?.data.tags ?? [];
}

export async function addCustomTag(creds: AppCredentials, studentId: string, tag: CustomTag): Promise<CustomTag[]> {
  const result = await updateJsonFileWithRetry(
    creds,
    tagsPath(studentId),
    defaultTagsFile(),
    (current) => ({ ...current, tags: [...current.tags, tag] }),
    `Add tag "${tag.label}" to question ${tag.questionId}`
  );
  return result.tags;
}
