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

function findOpenDesktopPosition(occupied) {
  for (let slot = 0; slot < 1000; slot += 1) {
    const candidate = { x: (slot % 3) * 336, y: Math.floor(slot / 3) * 360 };
    const overlaps = occupied.some((position) =>
      Math.abs(position.x - candidate.x) < 320 && Math.abs(position.y - candidate.y) < 340
    );
    if (!overlaps) return candidate;
  }
  return { x: 0, y: occupied.length * 360 };
}

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

function GripIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <circle cx="6" cy="5" r="1.25" />
      <circle cx="14" cy="5" r="1.25" />
      <circle cx="6" cy="10" r="1.25" />
      <circle cx="14" cy="10" r="1.25" />
      <circle cx="6" cy="15" r="1.25" />
      <circle cx="14" cy="15" r="1.25" />
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

function formatContextDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function ScreenshotGroup({ images, onDeleteImage }) {
  const context = images[0];

  return (
    <section className="overflow-hidden rounded-xl border border-black/10 bg-white/55 dark:border-black/10 dark:bg-zinc-50/80">
      {context.context_title && (
        <div className="border-b border-black/10 px-3 py-2 dark:border-black/10">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-800">
              Screenshots from: {context.context_title}
            </p>
            <time className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {formatContextDate(context.context_updated_at)}
            </time>
          </div>
          {context.context_content?.trim() && (
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-600 dark:text-zinc-600">
              {context.context_content}
            </p>
          )}
        </div>
      )}
      <div className="grid gap-2 p-2">
        {images.map((image) => (
          <NoteImage key={image.id} image={image} onDelete={() => onDeleteImage(image.id)} />
        ))}
      </div>
    </section>
  );
}

function NoteCard({
  note,
  isMoving,
  isMergeTarget,
  desktopMergeEnabled,
  onMoveStart,
  onUpdate,
  onDelete,
  onAddImage,
  onDeleteImage,
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isImageDragging, setIsImageDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const saveTimer = useRef(null);
  const fileInput = useRef(null);
  const noteColor = note.color || '#ffffff';
  const imageGroups = useMemo(() => {
    const groups = new Map();
    for (const image of note.images || []) {
      const key = image.context_title
        ? `${image.context_title}|${image.context_updated_at || ''}|${image.context_content || ''}`
        : `unmerged:${image.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(image);
    }
    return [...groups.values()].sort((a, b) => {
      const first = new Date(a[0].context_updated_at || a[0].created_at).getTime();
      const second = new Date(b[0].context_updated_at || b[0].created_at).getTime();
      return second - first;
    });
  }, [note.images]);

  useEffect(() => setTitle(note.title), [note.title]);
  useEffect(() => setContent(note.content), [note.content]);
  useEffect(() => () => clearTimeout(saveTimer.current), []);

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
      className={`group relative flex flex-col gap-2 rounded-2xl border bg-white p-4 shadow-sm transition-all hover:shadow-md dark:bg-white dark:shadow-lg dark:shadow-black/45 ${
        isImageDragging
          ? 'border-blue-500 ring-4 ring-blue-500/20 dark:border-blue-400'
          : isMoving
            ? 'border-zinc-300 shadow-sm dark:border-zinc-300'
            : isMergeTarget
              ? 'border-violet-500 ring-4 ring-violet-500/25 dark:border-violet-400'
            : 'border-zinc-200 dark:border-zinc-300'
      }`}
      style={{ background: noteColor === '#ffffff' ? undefined : `${noteColor}55` }}
      onPointerDown={(e) => {
        if (desktopMergeEnabled && !e.target.closest('input, textarea, button, a')) {
          clearTimeout(saveTimer.current);
          onMoveStart(note.id, e, { title, content });
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('Files')) setIsImageDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsImageDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsImageDragging(false);
        if (e.dataTransfer.files.length) {
          e.stopPropagation();
          addImages(e.dataTransfer.files);
        }
      }}
    >
      {isImageDragging && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-xl bg-blue-50/95 text-sm font-semibold text-blue-700 backdrop-blur dark:bg-blue-950/90 dark:text-blue-200">
          Drop screenshots here
        </div>
      )}
      {isMergeTarget && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-xl bg-violet-50/90 text-sm font-semibold text-violet-700 backdrop-blur dark:bg-violet-950/90 dark:text-violet-200">
          Release to merge here
        </div>
      )}
      <div className="flex min-w-0 items-start gap-2">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            clearTimeout(saveTimer.current);
            onMoveStart(note.id, e, { title, content });
          }}
          aria-label="Move note"
          title="Move note or place over another note to merge"
          className={`mt-0.5 touch-none cursor-grab rounded p-0.5 text-zinc-400 transition-opacity hover:text-zinc-700 active:cursor-grabbing dark:text-zinc-400 dark:hover:text-zinc-700 ${
            desktopMergeEnabled ? 'hidden lg:block lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100' : 'hidden'
          }`}
        >
          <GripIcon />
        </button>
        <input
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-900 dark:placeholder:text-zinc-400"
          value={title}
          placeholder="Untitled"
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleUpdate({ title: e.target.value });
          }}
        />
      </div>
      <div className="flex w-full flex-wrap items-center justify-end gap-1 overflow-hidden opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <div className="flex max-w-full flex-wrap items-center gap-1 rounded-full bg-white/80 px-1.5 py-1 shadow-sm ring-1 ring-zinc-200 backdrop-blur dark:bg-white dark:ring-zinc-300">
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
            className="rounded px-1.5 py-1 text-xs text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-black/5 dark:hover:text-zinc-900"
          >
            {note.is_pinned ? 'Pinned' : 'Pin'}
          </button>
          <button
            onClick={() => onUpdate(note.id, { is_private: !note.is_private })}
            title={note.is_private ? 'Make visible to workspace' : 'Make private (only you)'}
            className={`rounded p-1 text-xs transition-colors ${
              note.is_private
                ? 'text-emerald-500 hover:bg-black/5 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-white/5 dark:hover:text-emerald-300'
                : 'text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-black/5 dark:hover:text-zinc-900'
            }`}
          >
            {note.is_private ? '🔒' : '🔓'}
          </button>
          <button
            onClick={() => onDelete(note.id)}
            aria-label="Delete note"
            title="Delete note"
            className="rounded p-1 text-red-500 hover:bg-red-500/10 hover:text-red-600"
          >
            <TrashIcon />
          </button>
      </div>
      <textarea
        className="min-h-[80px] resize-none bg-transparent text-sm text-zinc-600 outline-none placeholder:text-zinc-400 dark:text-zinc-700 dark:placeholder:text-zinc-400"
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
          {imageGroups.map((images) => (
            <ScreenshotGroup
              key={`${images[0].context_title || 'screenshot'}:${images[0].id}`}
              images={images}
              onDeleteImage={(imageId) => onDeleteImage(note.id, imageId)}
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
          className="rounded-lg border border-black/10 bg-white/60 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-60 dark:border-black/10 dark:bg-zinc-50 dark:text-zinc-700 dark:hover:bg-zinc-100"
        >
          {uploading ? 'Adding screenshot...' : '+ Screenshot'}
        </button>
        <span className="text-[10px] text-zinc-500">Drop or paste images</span>
      </div>
      {imageError && <p className="text-xs text-red-600 dark:text-red-400">{imageError}</p>}
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-500">
        <span className="flex items-center gap-1">
          {note.is_private && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
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

export default function NotesList({
  notes,
  onCreate,
  onUpdate,
  onDelete,
  onAddImage,
  onDeleteImage,
  onMerge,
}) {
  const [query, setQuery] = useState('');
  const [desktopMergeEnabled, setDesktopMergeEnabled] = useState(false);
  const [positions, setPositions] = useState({});
  const [movingNoteId, setMovingNoteId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [isPanning, setIsPanning] = useState(false);
  const boardRef = useRef(null);
  const scrollerRef = useRef(null);
  const dragRef = useRef(null);
  const panRef = useRef(null);

  const filteredNotes = useMemo(() => {
    const term = query.trim().toLowerCase();
    return [...notes]
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        if ((a.sort_order ?? 0) !== (b.sort_order ?? 0)) return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        return new Date(b.updated_at) - new Date(a.updated_at);
      })
      .filter((note) => {
        if (!term) return true;
        return `${note.title} ${note.content} ${note.author_name || ''}`.toLowerCase().includes(term);
      });
  }, [notes, query]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktopMergeEnabled(media.matches);
    update();
    media.addEventListener('change', update);
    return () => {
      media.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (!desktopMergeEnabled) return;
    setPositions((current) => {
      const next = { ...current };
      const occupied = Object.values(next);
      filteredNotes.forEach((note) => {
        if (next[note.id]) return;
        next[note.id] = Number.isFinite(note.position_x) && Number.isFinite(note.position_y)
          ? { x: note.position_x, y: note.position_y }
          : findOpenDesktopPosition(occupied);
        occupied.push(next[note.id]);
      });
      return next;
    });
  }, [desktopMergeEnabled, filteredNotes]);

  useEffect(() => {
    if (!desktopMergeEnabled) return undefined;

    function handlePointerMove(e) {
      const pan = panRef.current;
      if (pan && pan.pointerId === e.pointerId) {
        scrollerRef.current.scrollLeft = pan.scrollLeft - (e.clientX - pan.startX);
        scrollerRef.current.scrollTop = pan.scrollTop - (e.clientY - pan.startY);
        return;
      }

      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const position = {
        x: Math.max(0, Math.round(drag.originX + e.clientX - drag.startX)),
        y: Math.max(0, Math.round(drag.originY + e.clientY - drag.startY)),
      };
      drag.position = position;
      setPositions((current) => ({ ...current, [drag.id]: position }));

      const target = [...boardRef.current.querySelectorAll('[data-note-id]')].find((element) => {
        if (element.dataset.noteId === drag.id) return false;
        const rect = element.getBoundingClientRect();
        return e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      });
      drag.mergeTargetId = target?.dataset.noteId || '';
      setMergeTargetId(drag.mergeTargetId);
    }

    async function handlePointerUp(e) {
      const pan = panRef.current;
      if (pan && pan.pointerId === e.pointerId) {
        panRef.current = null;
        setIsPanning(false);
        return;
      }

      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
      setMovingNoteId('');
      setMergeTargetId('');
      const position = drag.position || { x: drag.originX, y: drag.originY };
      await onUpdate(drag.id, { ...drag.draft, position_x: position.x, position_y: position.y });

      const source = notes.find((note) => note.id === drag.id);
      const target = notes.find((note) => note.id === drag.mergeTargetId);
      if (
        target &&
        window.confirm(`Merge "${source.title || 'Untitled'}" into "${target.title || 'Untitled'}"? The moved note will be removed.`)
      ) {
        await onMerge(source.id, target.id);
      }
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [desktopMergeEnabled, notes, onMerge, onUpdate]);

  function handleMoveStart(noteId, event, draft) {
    if (!desktopMergeEnabled || query.trim()) return;
    event.preventDefault();
    const position = positions[noteId] || { x: 0, y: 0 };
    dragRef.current = {
      id: noteId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      draft,
    };
    setMovingNoteId(noteId);
  }

  function handlePanStart(event) {
    if (!desktopMergeEnabled || event.target !== event.currentTarget) return;
    event.preventDefault();
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: scrollerRef.current.scrollLeft,
      scrollTop: scrollerRef.current.scrollTop,
    };
    setIsPanning(true);
  }

  const boardSize = useMemo(() => ({
    width: Math.max(1100, ...filteredNotes.map((note) => (positions[note.id]?.x || 0) + 360)),
    height: Math.max(700, ...filteredNotes.map((note) => (positions[note.id]?.y || 0) + 620)),
  }), [filteredNotes, positions]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-zinc-200 px-4 py-3 sm:px-6 dark:border-slate-600/60 dark:bg-[#202c40]">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-base font-semibold text-zinc-900 dark:text-zinc-100">Notes</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-36 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-1 focus:ring-zinc-400 dark:bg-[#2a374c] dark:text-zinc-100 dark:placeholder:text-slate-400 dark:focus:ring-emerald-500 sm:w-44"
          />
          <AiNoteAssistant onCreate={onCreate} onUpdate={onUpdate} />
          <button
            onClick={() => onCreate()}
            className="hidden rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 sm:block dark:bg-emerald-500 dark:hover:bg-emerald-400"
          >
            + New note
          </button>
        </div>
      </header>
      <div ref={scrollerRef} className="flex-1 overflow-auto p-4 sm:p-6">
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-zinc-600 dark:text-zinc-300">
            {notes.length === 0 ? (
              <>
                <span className="text-sm font-medium">No notes yet.</span>
                <p className="text-sm">Start this workspace with your first note.</p>
                <button
                  onClick={() => onCreate()}
                  className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-400"
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
          <div
            ref={boardRef}
            className={desktopMergeEnabled
              ? `relative bg-transparent bg-[radial-gradient(circle,_rgba(100,116,139,0.15)_1px,_transparent_1px)] [background-size:24px_24px] dark:bg-transparent dark:bg-[radial-gradient(circle,_rgba(148,163,184,0.14)_1px,_transparent_1px)] ${
                  isPanning ? 'cursor-grabbing' : 'cursor-grab'
                }`
              : 'grid grid-cols-1 items-start gap-4 md:grid-cols-2'}
            style={desktopMergeEnabled ? { width: boardSize.width, height: boardSize.height } : undefined}
            onPointerDown={handlePanStart}
          >
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                data-note-id={note.id}
                className={desktopMergeEnabled ? 'absolute w-[320px]' : ''}
                style={desktopMergeEnabled ? {
                  transform: `translate3d(${positions[note.id]?.x || 0}px, ${positions[note.id]?.y || 0}px, 0)`,
                  zIndex: movingNoteId === note.id ? 20 : note.is_pinned ? 5 : 1,
                } : undefined}
              >
                <NoteCard
                  note={note}
                  isMoving={movingNoteId === note.id}
                  isMergeTarget={mergeTargetId === note.id}
                  desktopMergeEnabled={desktopMergeEnabled && !query.trim()}
                  onMoveStart={handleMoveStart}
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
