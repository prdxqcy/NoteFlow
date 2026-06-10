import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import AiNoteAssistant from './AiNoteAssistant';

const NOTE_COLORS = [
  { value: '#ffffff', label: 'Default' },
  { value: '#fef3c7', label: 'Amber' },
  { value: '#dbeafe', label: 'Blue' },
  { value: '#dcfce7', label: 'Green' },
  { value: '#fce7f3', label: 'Pink' },
  { value: '#ede9fe', label: 'Violet' },
];

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7l.7 11.1A2 2 0 0 0 10.2 20h3.6a2 2 0 0 0 2-1.9L16.5 7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v5M14 11v5" />
    </svg>
  );
}

function NoteImage({ image, onDelete }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    api.getNoteImage(image.id).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => {});
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image.id]);

  return (
    <div className="group/image relative overflow-hidden rounded-xl border border-black/10 bg-zinc-100 dark:border-white/10 dark:bg-zinc-800">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" title="Open full-size screenshot">
          <img src={url} alt="Note screenshot" className="max-h-56 w-full object-cover" />
        </a>
      ) : (
        <div className="h-28 animate-pulse bg-zinc-200 dark:bg-zinc-800" />
      )}
      <button
        type="button"
        onClick={onDelete}
        aria-label="Remove screenshot"
        title="Remove screenshot"
        className="absolute right-2 top-2 rounded-full bg-zinc-950/75 p-1.5 text-white opacity-0 backdrop-blur transition-opacity hover:bg-red-600 group-hover/image:opacity-100 focus:opacity-100"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function NoteCard({ note, onUpdate, onDelete, onAddImage, onDeleteImage }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const saveTimer = useRef(null);
  const fileInput = useRef(null);
  const noteColor = note.color || '#ffffff';

  function scheduleUpdate(patch) {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onUpdate(note.id, patch), 600);
  }

  async function addImages(files) {
    const images = [...files].filter((file) => file.type.startsWith('image/'));
    if (!images.length) return;
    setUploading(true);
    setImageError('');
    try {
      for (const image of images) {
        if (image.size > 10 * 1024 * 1024) throw new Error('Images must be smaller than 10 MB');
        await onAddImage(note.id, image);
      }
    } catch (err) {
      setImageError(err.message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <div
      className={`group relative flex flex-col gap-2 rounded-2xl border bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-zinc-900/90 ${
        isDragging
          ? 'border-blue-500 ring-4 ring-blue-500/20 dark:border-blue-400'
          : 'border-zinc-200 dark:border-zinc-800'
      }`}
      style={{ background: noteColor === '#ffffff' ? undefined : `${noteColor}55` }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        addImages(e.dataTransfer.files);
      }}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-xl bg-blue-50/95 text-sm font-semibold text-blue-700 backdrop-blur dark:bg-blue-950/90 dark:text-blue-200">
          Drop screenshots here
        </div>
      )}
      <div className="flex items-start gap-2">
        <input
          className="flex-1 bg-transparent text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          value={title}
          placeholder="Untitled"
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleUpdate({ title: e.target.value });
          }}
        />
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex items-center gap-1 rounded-full bg-white/80 px-1.5 py-1 shadow-sm ring-1 ring-zinc-200 backdrop-blur dark:bg-zinc-950/80 dark:ring-zinc-700">
            {NOTE_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => onUpdate(note.id, { color: color.value })}
                aria-label={`Set note color to ${color.label}`}
                title={color.label}
                className={`h-3.5 w-3.5 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110 ${
                  noteColor === color.value ? 'ring-2 ring-zinc-900 dark:ring-zinc-100' : ''
                }`}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>
          <button
            onClick={() => onUpdate(note.id, { is_pinned: !note.is_pinned })}
            title={note.is_pinned ? 'Unpin' : 'Pin'}
            className="rounded p-1 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-200"
          >
            {note.is_pinned ? 'Pinned' : 'Pin'}
          </button>
          <button
            onClick={() => onUpdate(note.id, { is_private: !note.is_private })}
            title={note.is_private ? 'Make visible to workspace' : 'Make private (only you)'}
            className={`rounded p-1 text-xs transition-colors ${
              note.is_private
                ? 'text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-200'
            }`}
          >
            {note.is_private ? '🔒' : '🔓'}
          </button>
          <button
            onClick={() => onDelete(note.id)}
            aria-label="Delete note"
            title="Delete note"
            className="rounded p-1 text-red-500 hover:text-red-600"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
      <textarea
        className="min-h-[80px] resize-none bg-transparent text-sm text-zinc-600 outline-none placeholder:text-zinc-400 dark:text-zinc-400 dark:placeholder:text-zinc-700"
        value={content}
        placeholder="Write something..."
        onChange={(e) => {
          setContent(e.target.value);
          scheduleUpdate({ content: e.target.value });
        }}
        onPaste={(e) => {
          const images = [...e.clipboardData.files].filter((file) => file.type.startsWith('image/'));
          if (images.length) {
            e.preventDefault();
            addImages(images);
          }
        }}
      />
      {(note.images || []).length > 0 && (
        <div className="grid gap-2">
          {(note.images || []).map((image) => (
            <NoteImage
              key={image.id}
              image={image}
              onDelete={() => onDeleteImage(note.id, image.id)}
            />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={(e) => addImages(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-black/10 bg-white/60 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-60 dark:border-white/10 dark:bg-zinc-950/30 dark:text-zinc-300 dark:hover:bg-zinc-950/60"
        >
          {uploading ? 'Adding screenshot...' : '+ Screenshot'}
        </button>
        <span className="text-[10px] text-zinc-500">Drop or paste images</span>
      </div>
      {imageError && <p className="text-xs text-red-600 dark:text-red-400">{imageError}</p>}
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-600">
        <span className="flex items-center gap-1">
          {note.is_private && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Private
            </span>
          )}
          {note.author_name}
        </span>
        <span>{new Date(note.updated_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

export default function NotesList({ notes, onCreate, onUpdate, onDelete, onAddImage, onDeleteImage }) {
  const [query, setQuery] = useState('');

  const filteredNotes = useMemo(() => {
    const term = query.trim().toLowerCase();
    return [...notes]
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.updated_at) - new Date(a.updated_at);
      })
      .filter((note) => {
        if (!term) return true;
        return `${note.title} ${note.content} ${note.author_name || ''}`.toLowerCase().includes(term);
      });
  }, [notes, query]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-zinc-200 px-4 py-3 sm:px-6 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-base font-semibold text-zinc-900 dark:text-zinc-100">Notes</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-36 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:ring-zinc-600 sm:w-44"
          />
          <AiNoteAssistant onCreate={onCreate} onUpdate={onUpdate} />
          <button
            onClick={() => onCreate()}
            className="hidden rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 sm:block dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            + New note
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-zinc-600 dark:text-zinc-300">
            {notes.length === 0 ? (
              <>
                <span className="text-sm font-medium">No notes yet.</span>
                <p className="text-sm">Start this workspace with your first note.</p>
                <button
                  onClick={() => onCreate()}
                  className="mt-2 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  Add your first note
                </button>
              </>
            ) : (
              <>
                <span className="text-sm font-medium">No matching notes yet.</span>
                <p className="text-sm">Try a broader search or create a fresh note.</p>
              </>
            )}
          </div>
        ) : (
          <div className="columns-1 gap-4 md:columns-2 xl:columns-3 2xl:columns-4">
            {filteredNotes.map((note) => (
              <div key={note.id} className="mb-4 break-inside-avoid">
                <NoteCard
                  note={note}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onAddImage={onAddImage}
                  onDeleteImage={onDeleteImage}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
