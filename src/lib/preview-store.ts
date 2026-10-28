/**
 * In-memory object-URL previews for files picked in this browser tab. Files are never
 * uploaded; after a refresh only the persisted file metadata remains.
 */
const store = new Map<string, { url: string; type: string }>();

export const previewStore = {
  set(key: string, file: File) {
    const old = store.get(key);
    if (old) URL.revokeObjectURL(old.url);
    const url = URL.createObjectURL(file);
    store.set(key, { url, type: file.type });
    return url;
  },
  get(key: string) {
    return store.get(key) ?? null;
  },
  remove(key: string) {
    const old = store.get(key);
    if (old) URL.revokeObjectURL(old.url);
    store.delete(key);
  },
};
