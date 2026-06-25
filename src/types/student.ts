export interface Student {
  id: string; // slug, e.g. "rahul-sharma"
  name: string;
  email?: string;
  joinedAt: string;
  isActive: boolean;
}

// data/students.json shape
export interface StudentsFile {
  version: number;
  students: Student[];
  mentor: {
    id: string;
    name: string;
  };
}

export interface BookmarkFolder {
  id: string;
  name: string; // "Revision", "Mistakes", "Reattempt", custom...
  createdAt: string;
}

export interface Bookmark {
  id: string;
  questionId: string;
  folderId: string;
  note?: string;
  createdAt: string;
}

// student-data/<student-id>/bookmarks.json shape
export interface BookmarksFile {
  version: number;
  folders: BookmarkFolder[];
  bookmarks: Bookmark[];
}

export interface Note {
  id: string;
  questionId: string;
  content: string; // markdown
  createdAt: string;
  updatedAt: string;
}

// student-data/<student-id>/notes.json shape
export interface NotesFile {
  version: number;
  notes: Note[];
}

export interface CustomTag {
  id: string;
  questionId: string;
  label: string;
  createdAt: string;
}

// student-data/<student-id>/tags.json shape
export interface TagsFile {
  version: number;
  tags: CustomTag[];
}
