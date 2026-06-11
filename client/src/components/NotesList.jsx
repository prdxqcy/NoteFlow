import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import AiNoteAssistant from './AiNoteAssistant';

const NOTE_COLORS = [
  { value: '#ffffff', label: 'Default' },
  { value: '#fbbf24', label: 'Amber' },
  { value: '#60a5fa', label: 'Blue' },
  { value: '#4ade80', label: 'Green' },
  { value: '#f87171', label: 'Red' },
  { value: '#a78bfa', label: 'Violet' },
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

const DEFAULT_NOTE_SIZE = { width: 320, height: 360 };
const MIN_NOTE_SIZE = { width: 260, height: 180 };
const MAX_NOTE_SIZE = { width: 760, height: 900 };
const MIN_BOARD_SCALE = 0.5;
const MAX_BOARD_SCALE = 1.8;

function clampBoardScale(value) {
  return Math.min(MAX_BOARD_SCALE, Math.max(MIN_BOARD_SCALE, value));
}

function getNoteSize(note) {
  const width = Number.isFinite(note.note_width) ? note.note_width : DEFAULT_NOTE_SIZE.width;
  const height = Number.isFinite(note.note_height) ? note.note_height : DEFAULT_NOTE_SIZE.height;
  return {
    width: Math.min(MAX_NOTE_SIZE.width, Math.max(MIN_NOTE_SIZE.width, width)),
    height: Math.min(MAX_NOTE_SIZE.height, Math.max(MIN_NOTE_SIZE.height, height)),
  };
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

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6a4 4 0 0 1 0 8h-2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17H9a4 4 0 0 1 0-8h2" />
    </svg>
  );
}

function getLinkAnchor(noteId, direction, positions, sizes) {
  const position = positions[noteId] || { x: 0, y: 0 };
  const size = sizes[noteId] || DEFAULT_NOTE_SIZE;
  return direction === 'right'
    ? { x: position.x + size.width, y: position.y + (size.height / 2) }
    : { x: position.x, y: position.y + (size.height / 2) };
}

function getLinkPath(start, end) {
  const curve = Math.max(48, Math.abs(end.x - start.x) * 0.35);
  return `M ${start.x} ${start.y} C ${start.x + curve} ${start.y}, ${end.x - curve} ${end.y}, ${end.x} ${end.y}`;
}

function NoteImage({ image, onDelete, onAddAnnotation, onDeleteAnnotation }) {
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
        <div className="relative">
          <img
            src={url}
            alt="Note screenshot"
            className="max-h-56 w-full cursor-crosshair object-cover"
            title="Click to pin feedback"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const kind = window.prompt('Annotation type: comment, highlight, box, or arrow', 'comment') || 'comment';
              const body = window.prompt('Pinned screenshot comment');
              if (!body) return;
              onAddAnnotation(image.id, {
                kind,
                x: ((event.clientX - rect.left) / rect.width) * 100,
                y: ((event.clientY - rect.top) / rect.height) * 100,
                width: kind === 'comment' ? null : 20,
                height: kind === 'comment' ? null : 15,
                body,
              });
            }}
          />
          {(image.annotations || []).map((annotation, index) => ['comment', 'arrow'].includes(annotation.kind) ? (
              <button key={annotation.id} type="button" onClick={() => window.confirm(`Delete annotation: ${annotation.body}?`) && onDeleteAnnotation(image.id, annotation.id)} title={`${annotation.display_name || 'Member'}: ${annotation.body} (click to delete)`} className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white shadow ring-2 ring-white" style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}>{annotation.kind === 'arrow' ? '→' : index + 1}</button>
            ) : (
              <div key={annotation.id} title={`${annotation.display_name || 'Member'}: ${annotation.body}`} className={`pointer-events-none absolute border-2 border-emerald-500 ${annotation.kind === 'highlight' ? 'bg-yellow-300/35' : 'bg-transparent'}`} style={{ left: `${annotation.x}%`, top: `${annotation.y}%`, width: `${annotation.width || 20}%`, height: `${annotation.height || 15}%` }} />
            ))}
        </div>
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

function ScreenshotGroup({ images, onDeleteImage, onAddAnnotation, onDeleteAnnotation }) {
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
          <NoteImage key={image.id} image={image} onDelete={() => onDeleteImage(image.id)} onAddAnnotation={onAddAnnotation} onDeleteAnnotation={onDeleteAnnotation} />
        ))}
      </div>
    </section>
  );
}

function MergedNoteSection({ section, images, onUpdate, onDeleteImage, onAddAnnotation, onDeleteAnnotation }) {
  const [title, setTitle] = useState(section.title);
  const [content, setContent] = useState(section.content);
  const saveTimer = useRef(null);

  useEffect(() => setTitle(section.title), [section.title]);
  useEffect(() => setContent(section.content), [section.content]);
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  function scheduleUpdate(patch) {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onUpdate(section.id, patch), 600);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-black/10 bg-white/55 dark:border-black/10 dark:bg-zinc-50/80">
      <div className="border-b border-black/10 p-3 dark:border-black/10">
        <div className="flex items-center justify-between gap-2">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              scheduleUpdate({ title: e.target.value });
            }}
            className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-zinc-800 outline-none"
            aria-label="Merged note section title"
          />
          <time className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            {formatContextDate(section.context_updated_at)}
          </time>
        </div>
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            scheduleUpdate({ content: e.target.value });
          }}
          placeholder="Write something..."
          className="mt-2 min-h-[64px] w-full resize-y bg-transparent text-xs leading-relaxed text-zinc-600 outline-none placeholder:text-zinc-400"
          aria-label={`Text for ${title || 'merged note section'}`}
        />
      </div>
      {images.length > 0 && (
        <div className="grid gap-2 p-2">
          {images.map((image) => (
            <NoteImage key={image.id} image={image} onDelete={() => onDeleteImage(image.id)} onAddAnnotation={onAddAnnotation} onDeleteAnnotation={onDeleteAnnotation} />
          ))}
        </div>
      )}
    </section>
  );
}

function NoteCard({
  note,
  isMoving,
  isMergeTarget,
  desktopMergeEnabled,
  isLinking,
  onMoveStart,
  onLinkStart,
  onZoomToNote,
  onUpdate,
  onUpdateSection,
  onDelete,
  onAddImage,
  onDeleteImage,
  onAddAnnotation,
  onDeleteAnnotation,
  onResizeStart,
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isImageDragging, setIsImageDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const saveTimer = useRef(null);
  const fileInput = useRef(null);
  const zoomIntentRef = useRef(null);
  const noteColor = note.color || '#ffffff';
  const imageGroups = useMemo(() => {
    const groups = new Map();
    for (const image of note.images || []) {
      if (image.section_id) continue;
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
  const sections = note.sections || [];

  useEffect(() => setTitle(note.title), [note.title]);
  useEffect(() => setContent(note.content), [note.content]);
  useEffect(() => () => {
    clearTimeout(saveTimer.current);
    zoomIntentRef.current = null;
  }, []);

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

  function maybeZoomIntoEditable(target) {
    if (!onZoomToNote) return false;
    return onZoomToNote(note.id, target);
  }

  function beginZoomIntent(event) {
    zoomIntentRef.current = {
      target: event.currentTarget,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  function cancelZoomIntent(event) {
    const zoomIntent = zoomIntentRef.current;
    if (!zoomIntent || zoomIntent.pointerId !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - zoomIntent.startX, event.clientY - zoomIntent.startY);
    if (moved > 6) {
      zoomIntentRef.current = null;
    }
  }

  function commitZoomIntent(event) {
    const zoomIntent = zoomIntentRef.current;
    zoomIntentRef.current = null;
    if (!zoomIntent || zoomIntent.pointerId !== event.pointerId) return;
    if (maybeZoomIntoEditable(zoomIntent.target)) {
      event.preventDefault();
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
      } ${desktopMergeEnabled ? 'h-full overflow-auto' : ''}`}
      style={{ background: noteColor === '#ffffff' ? undefined : noteColor }}
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
          onPointerDown={beginZoomIntent}
          onPointerMove={cancelZoomIntent}
          onPointerUp={commitZoomIntent}
          onPointerCancel={() => { zoomIntentRef.current = null; }}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleUpdate({ title: e.target.value });
          }}
        />
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            clearTimeout(saveTimer.current);
            onLinkStart(note.id, e);
          }}
          aria-label="Connect note"
          title="Connect note"
          className={`mt-0.5 hidden h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-black/5 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-black/5 dark:hover:text-zinc-800 lg:flex ${
            desktopMergeEnabled ? 'lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100' : ''
          } ${isLinking ? 'bg-emerald-100 text-emerald-700 opacity-100 dark:bg-emerald-200/80 dark:text-emerald-900' : ''}`}
        >
          <LinkIcon />
        </button>
      </div>
      <div className="sticky top-0 z-20 flex w-full shrink-0 items-center justify-end gap-1 overflow-visible py-1">
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/85 px-1.5 py-1 shadow-sm ring-1 ring-zinc-200 dark:bg-white dark:ring-zinc-300">
            {NOTE_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => onUpdate(note.id, { color: color.value })}
                aria-label={`Set note color to ${color.label}`}
                title={color.label}
                className={`h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110 ${
                  noteColor === color.value ? 'ring-2 ring-zinc-900 dark:ring-zinc-100' : ''
                }`}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>
          <button
            onClick={() => onUpdate(note.id, { is_pinned: !note.is_pinned })}
            title={note.is_pinned ? 'Unpin' : 'Pin'}
            className="shrink-0 rounded px-1.5 py-1 text-xs text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-black/5 dark:hover:text-zinc-900"
          >
            {note.is_pinned ? 'Pinned' : 'Pin'}
          </button>
          <button
            onClick={() => onUpdate(note.id, { is_private: !note.is_private })}
            aria-label={note.is_private ? 'Make visible to workspace' : 'Make private'}
            title={note.is_private ? 'Make visible to workspace' : 'Make private (only you)'}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded p-1 text-xs transition-colors ${
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
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded p-1 text-red-500 hover:bg-red-500/10 hover:text-red-600"
          >
            <TrashIcon />
          </button>
      </div>
      {sections.length === 0 && (
        <textarea
          className={`min-h-[80px] resize-none bg-transparent text-sm text-zinc-600 outline-none placeholder:text-zinc-400 dark:text-zinc-700 dark:placeholder:text-zinc-400 ${
            desktopMergeEnabled ? 'flex-1' : ''
          }`}
          value={content}
          placeholder="Write something..."
          onPointerDown={beginZoomIntent}
          onPointerMove={cancelZoomIntent}
          onPointerUp={commitZoomIntent}
          onPointerCancel={() => { zoomIntentRef.current = null; }}
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
      )}
      {sections.length > 0 && (
        <div className="grid gap-2">
          {sections.map((section) => (
            <MergedNoteSection
              key={section.id}
              section={section}
              images={(note.images || []).filter((image) => image.section_id === section.id)}
              onUpdate={(sectionId, patch) => onUpdateSection(note.id, sectionId, patch)}
              onDeleteImage={(imageId) => onDeleteImage(note.id, imageId)}
              onAddAnnotation={onAddAnnotation}
              onDeleteAnnotation={onDeleteAnnotation}
            />
          ))}
        </div>
      )}
      {imageGroups.length > 0 && (
        <div className="grid gap-2">
          {imageGroups.map((images) => (
            <ScreenshotGroup
              key={`${images[0].context_title || 'screenshot'}:${images[0].id}`}
              images={images}
              onDeleteImage={(imageId) => onDeleteImage(note.id, imageId)}
              onAddAnnotation={onAddAnnotation}
              onDeleteAnnotation={onDeleteAnnotation}
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
      {desktopMergeEnabled && (
        <>
          <button
            type="button"
            aria-label="Resize note horizontally"
            title="Resize note horizontally"
            onPointerDown={(e) => onResizeStart(note.id, e, 'x')}
            className="absolute bottom-8 right-0 hidden h-12 w-2 cursor-ew-resize touch-none rounded-l bg-zinc-400/0 transition-colors hover:bg-zinc-400/35 lg:block"
          />
          <button
            type="button"
            aria-label="Resize note vertically"
            title="Resize note vertically"
            onPointerDown={(e) => onResizeStart(note.id, e, 'y')}
            className="absolute bottom-0 right-8 hidden h-2 w-12 cursor-ns-resize touch-none rounded-t bg-zinc-400/0 transition-colors hover:bg-zinc-400/35 lg:block"
          />
          <button
            type="button"
            aria-label="Resize note"
            title="Resize note"
            onPointerDown={(e) => onResizeStart(note.id, e, 'xy')}
            className="absolute bottom-1.5 right-1.5 hidden h-4 w-4 cursor-nwse-resize touch-none rounded-sm border-b-2 border-r-2 border-zinc-400/75 opacity-0 transition-opacity hover:border-zinc-600 group-hover:opacity-100 focus:opacity-100 lg:block"
          />
        </>
      )}
    </div>
  );
}

export default function NotesList({
  notes,
  onCreate,
  onUpdate,
  onUpdateSection,
  onCreateLink,
  onDeleteLink,
  onDelete,
  onAddImage,
  onDeleteImage,
  onAddAnnotation,
  onDeleteAnnotation,
  onMerge,
}) {
  const [query, setQuery] = useState('');
  const [desktopMergeEnabled, setDesktopMergeEnabled] = useState(false);
  const [positions, setPositions] = useState({});
  const [sizes, setSizes] = useState({});
  const [movingNoteId, setMovingNoteId] = useState('');
  const [resizingNoteId, setResizingNoteId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [linkingNoteId, setLinkingNoteId] = useState('');
  const [linkTargetId, setLinkTargetId] = useState('');
  const [draftLinkPoint, setDraftLinkPoint] = useState(null);
  const [boardScale, setBoardScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const boardRef = useRef(null);
  const scrollerRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const panRef = useRef(null);
  const linkRef = useRef(null);

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

  const filteredNoteIds = useMemo(() => new Set(filteredNotes.map((note) => note.id)), [filteredNotes]);
  const boardLinks = useMemo(() => {
    const unique = new Map();
    filteredNotes.forEach((note) => {
      (note.links || []).forEach((link) => {
        if (!filteredNoteIds.has(link.source_note_id) || !filteredNoteIds.has(link.target_note_id)) return;
        if (!unique.has(link.id)) unique.set(link.id, link);
      });
    });
    return [...unique.values()];
  }, [filteredNotes, filteredNoteIds]);

  useEffect(() => {
    if (!desktopMergeEnabled) {
      setBoardScale(1);
    }
  }, [desktopMergeEnabled]);

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
    setSizes((current) => {
      const next = { ...current };
      filteredNotes.forEach((note) => {
        const noteSize = getNoteSize(note);
        if (
          !next[note.id] ||
          (resizingNoteId !== note.id && Number.isFinite(note.note_width) && Number.isFinite(note.note_height) &&
            (next[note.id].width !== noteSize.width || next[note.id].height !== noteSize.height))
        ) {
          next[note.id] = noteSize;
        }
      });
      return next;
    });
  }, [desktopMergeEnabled, filteredNotes, resizingNoteId]);

  useEffect(() => {
    if (!desktopMergeEnabled) return undefined;

    function handlePointerMove(e) {
      const pan = panRef.current;
      const link = linkRef.current;
      if (link && link.pointerId === e.pointerId) {
        const boardRect = boardRef.current?.getBoundingClientRect();
        if (!boardRect) return;
        setDraftLinkPoint({
          x: (e.clientX - boardRect.left + scrollerRef.current.scrollLeft) / boardScale,
          y: (e.clientY - boardRect.top + scrollerRef.current.scrollTop) / boardScale,
        });
        const target = [...boardRef.current.querySelectorAll('[data-note-id]')].find((element) => {
          if (element.dataset.noteId === link.id) return false;
          const rect = element.getBoundingClientRect();
          return e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
        });
        setLinkTargetId(target?.dataset.noteId || '');
        return;
      }
      if (pan && pan.pointerId === e.pointerId) {
        scrollerRef.current.scrollLeft = pan.scrollLeft - (e.clientX - pan.startX);
        scrollerRef.current.scrollTop = pan.scrollTop - (e.clientY - pan.startY);
        return;
      }

      const drag = dragRef.current;
      const resize = resizeRef.current;
      if (resize && resize.pointerId === e.pointerId) {
        const nextSize = {
          width: resize.direction.includes('x')
            ? Math.min(MAX_NOTE_SIZE.width, Math.max(MIN_NOTE_SIZE.width, Math.round(resize.originWidth + ((e.clientX - resize.startX) / boardScale))))
            : resize.originWidth,
          height: resize.direction.includes('y')
            ? Math.min(MAX_NOTE_SIZE.height, Math.max(MIN_NOTE_SIZE.height, Math.round(resize.originHeight + ((e.clientY - resize.startY) / boardScale))))
            : resize.originHeight,
        };
        resize.size = nextSize;
        setSizes((current) => ({ ...current, [resize.id]: nextSize }));
        return;
      }

      if (!drag || drag.pointerId !== e.pointerId) return;
      const position = {
        x: Math.max(0, Math.round(drag.originX + ((e.clientX - drag.startX) / boardScale))),
        y: Math.max(0, Math.round(drag.originY + ((e.clientY - drag.startY) / boardScale))),
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
      const link = linkRef.current;
      if (link && link.pointerId === e.pointerId) {
        linkRef.current = null;
        const sourceId = link.id;
        const targetId = linkTargetId;
        setLinkingNoteId('');
        setLinkTargetId('');
        setDraftLinkPoint(null);
        if (targetId) {
          await onCreateLink(sourceId, targetId);
        }
        return;
      }
      if (pan && pan.pointerId === e.pointerId) {
        panRef.current = null;
        setIsPanning(false);
        return;
      }

      const drag = dragRef.current;
      const resize = resizeRef.current;
      if (resize && resize.pointerId === e.pointerId) {
        resizeRef.current = null;
        setResizingNoteId('');
        const size = resize.size || { width: resize.originWidth, height: resize.originHeight };
        await onUpdate(resize.id, { note_width: size.width, note_height: size.height });
        return;
      }

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
  }, [boardScale, desktopMergeEnabled, linkTargetId, notes, onCreateLink, onMerge, onUpdate]);

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

  function handleResizeStart(noteId, event, direction) {
    if (!desktopMergeEnabled || query.trim()) return;
    event.preventDefault();
    event.stopPropagation();
    const size = sizes[noteId] || getNoteSize(notes.find((note) => note.id === noteId) || {});
    resizeRef.current = {
      id: noteId,
      pointerId: event.pointerId,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: size.width,
      originHeight: size.height,
    };
    setResizingNoteId(noteId);
  }

  function handleLinkStart(noteId, event) {
    if (!desktopMergeEnabled || query.trim()) return;
    event.preventDefault();
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;
    linkRef.current = { id: noteId, pointerId: event.pointerId };
    setLinkingNoteId(noteId);
    setLinkTargetId('');
    setDraftLinkPoint({
      x: (event.clientX - boardRect.left + scrollerRef.current.scrollLeft) / boardScale,
      y: (event.clientY - boardRect.top + scrollerRef.current.scrollTop) / boardScale,
    });
  }

  function handleBoardZoom(nextScale) {
    if (!desktopMergeEnabled) return;
    setBoardScale(clampBoardScale(nextScale));
  }

  function centerNoteInView(noteId) {
    const scroller = scrollerRef.current;
    const noteElement = boardRef.current?.querySelector(`[data-note-id="${noteId}"]`);
    if (!scroller || !noteElement) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const noteRect = noteElement.getBoundingClientRect();
    const targetLeft = Math.max(
      0,
      scroller.scrollLeft + (noteRect.left - scrollerRect.left) - ((scroller.clientWidth - noteRect.width) / 2)
    );
    const targetTop = Math.max(
      0,
      scroller.scrollTop + (noteRect.top - scrollerRect.top) - ((scroller.clientHeight - noteRect.height) / 2)
    );
    scroller.scrollTo({ left: targetLeft, top: targetTop, behavior: 'smooth' });
  }

  function handleZoomToNote(noteId, target) {
    if (!desktopMergeEnabled || boardScale > MIN_BOARD_SCALE + 0.001) return false;
    if (!target?.matches?.('input, textarea')) return false;
    const nextScale = 1;
    setBoardScale(nextScale);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        centerNoteInView(noteId);
        target.focus();
      });
    });
    return true;
  }

  function handleBoardWheel(event) {
    if (!desktopMergeEnabled) return;
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.1 : -0.1;
    setBoardScale((current) => clampBoardScale(Number((current + delta).toFixed(2))));
  }

  function handlePanStart(event) {
    if (!desktopMergeEnabled || linkRef.current) return;
    if (event.target.closest('[data-note-id]')) return;
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
    width: Math.max(1100, ...filteredNotes.map((note) => (positions[note.id]?.x || 0) + (sizes[note.id]?.width || DEFAULT_NOTE_SIZE.width) + 40)),
    height: Math.max(700, ...filteredNotes.map((note) => (positions[note.id]?.y || 0) + (sizes[note.id]?.height || DEFAULT_NOTE_SIZE.height) + 120)),
  }), [filteredNotes, positions, sizes]);
  const scaledBoardSize = useMemo(() => ({
    width: boardSize.width * boardScale,
    height: boardSize.height * boardScale,
  }), [boardScale, boardSize]);

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
      <div ref={scrollerRef} className="flex-1 overflow-auto p-4 sm:p-6" onWheel={handleBoardWheel}>
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
          <div className="relative">
            {desktopMergeEnabled && (
              <div className="absolute right-3 top-3 z-30 flex items-center gap-1 rounded-full bg-white/92 p-1 shadow-sm ring-1 ring-zinc-200 backdrop-blur dark:bg-[#202c40]/92 dark:ring-slate-600">
                <button
                  type="button"
                  onClick={() => handleBoardZoom(boardScale - 0.1)}
                  aria-label="Zoom out"
                  title="Zoom out"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-[#344158] dark:hover:text-white"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => handleBoardZoom(1)}
                  aria-label="Reset zoom"
                  title="Reset zoom"
                  className="min-w-[3.25rem] rounded-full px-2 py-1 text-[11px] font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-[#344158] dark:hover:text-white"
                >
                  {Math.round(boardScale * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => handleBoardZoom(boardScale + 0.1)}
                  aria-label="Zoom in"
                  title="Zoom in"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-[#344158] dark:hover:text-white"
                >
                  +
                </button>
              </div>
            )}
            <div
              ref={boardRef}
              className={desktopMergeEnabled
                ? `relative bg-transparent bg-[radial-gradient(circle,_rgba(100,116,139,0.15)_1px,_transparent_1px)] [background-size:24px_24px] dark:bg-transparent dark:bg-[radial-gradient(circle,_rgba(148,163,184,0.14)_1px,_transparent_1px)] ${
                    isPanning ? 'cursor-grabbing' : 'cursor-grab'
                  }`
                : 'grid grid-cols-1 items-start gap-4 md:grid-cols-2'}
              style={desktopMergeEnabled ? { width: scaledBoardSize.width, height: scaledBoardSize.height } : undefined}
              onPointerDown={handlePanStart}
            >
              {desktopMergeEnabled && (
                <div
                  className="absolute left-0 top-0 origin-top-left"
                  style={{ width: boardSize.width, height: boardSize.height, transform: `scale(${boardScale})` }}
                >
                  <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible">
                <defs>
                  <marker id="note-link-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                    <path d="M0 0 L8 4 L0 8 Z" fill="#64748b" />
                  </marker>
                </defs>
                {boardLinks.map((link) => {
                  const sourceDirection = (positions[link.source_note_id]?.x || 0) <= (positions[link.target_note_id]?.x || 0) ? 'right' : 'left';
                  const targetDirection = sourceDirection === 'right' ? 'left' : 'right';
                  const start = getLinkAnchor(link.source_note_id, sourceDirection, positions, sizes);
                  const end = getLinkAnchor(link.target_note_id, targetDirection, positions, sizes);
                  return (
                    <path
                      key={link.id}
                      d={getLinkPath(start, end)}
                      className="pointer-events-auto cursor-pointer fill-none stroke-slate-400 stroke-[2.5] transition-colors hover:stroke-emerald-500"
                      markerEnd="url(#note-link-arrow)"
                      onClick={(event) => {
                        event.stopPropagation();
                        const confirmed = window.confirm('Delete this note connection?');
                        if (confirmed) onDeleteLink(link.source_note_id, link.id);
                      }}
                    />
                  );
                })}
                {linkingNoteId && draftLinkPoint && (() => {
                  const direction = (positions[linkingNoteId]?.x || 0) <= draftLinkPoint.x ? 'right' : 'left';
                  const start = getLinkAnchor(linkingNoteId, direction, positions, sizes);
                  const end = linkTargetId
                    ? getLinkAnchor(linkTargetId, direction === 'right' ? 'left' : 'right', positions, sizes)
                    : draftLinkPoint;
                  return (
                    <path
                      d={getLinkPath(start, end)}
                      className="fill-none stroke-emerald-500 stroke-[2.5]"
                      strokeDasharray={linkTargetId ? undefined : '7 5'}
                      markerEnd="url(#note-link-arrow)"
                    />
                  );
                })()}
                  </svg>
                  {filteredNotes.map((note) => (
                    <div
                      key={note.id}
                      data-note-id={note.id}
                      className="absolute z-10"
                      style={{
                        width: sizes[note.id]?.width || DEFAULT_NOTE_SIZE.width,
                        height: sizes[note.id]?.height || DEFAULT_NOTE_SIZE.height,
                        transform: `translate3d(${positions[note.id]?.x || 0}px, ${positions[note.id]?.y || 0}px, 0)`,
                        zIndex: movingNoteId === note.id || resizingNoteId === note.id ? 20 : note.is_pinned ? 5 : 1,
                      }}
                    >
                      <NoteCard
                        note={note}
                        isMoving={movingNoteId === note.id}
                        isMergeTarget={mergeTargetId === note.id}
                        isLinking={linkingNoteId === note.id}
                        desktopMergeEnabled={desktopMergeEnabled && !query.trim()}
                        onMoveStart={handleMoveStart}
                        onLinkStart={handleLinkStart}
                        onZoomToNote={handleZoomToNote}
                        onResizeStart={handleResizeStart}
                        onUpdate={onUpdate}
                        onUpdateSection={onUpdateSection}
                        onDelete={onDelete}
                        onAddImage={onAddImage}
                        onDeleteImage={onDeleteImage}
                        onAddAnnotation={onAddAnnotation}
                        onDeleteAnnotation={onDeleteAnnotation}
                      />
                    </div>
                  ))}
                </div>
              )}
              {!desktopMergeEnabled && filteredNotes.map((note) => (
                <div key={note.id}>
                  <NoteCard
                    note={note}
                    isMoving={movingNoteId === note.id}
                    isMergeTarget={mergeTargetId === note.id}
                    isLinking={linkingNoteId === note.id}
                    desktopMergeEnabled={false}
                    onMoveStart={handleMoveStart}
                    onLinkStart={handleLinkStart}
                    onZoomToNote={handleZoomToNote}
                    onResizeStart={handleResizeStart}
                    onUpdate={onUpdate}
                    onUpdateSection={onUpdateSection}
                    onDelete={onDelete}
                    onAddImage={onAddImage}
                    onDeleteImage={onDeleteImage}
                    onAddAnnotation={onAddAnnotation}
                    onDeleteAnnotation={onDeleteAnnotation}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
