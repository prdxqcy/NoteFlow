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

const VIEW_FILTERS = [
  { id: 'active', label: 'Active' },
  { id: 'pinned', label: 'Pinned' },
  { id: 'private', label: 'Private' },
  { id: 'linked', label: 'Linked' },
  { id: 'mine', label: 'Mine' },
  { id: 'archived', label: 'Archive' },
];

const SORT_MODES = [
  { id: 'manual', label: 'Board order' },
  { id: 'newest', label: 'Newest' },
  { id: 'edited', label: 'Recently edited' },
  { id: 'pinned', label: 'Pinned first' },
  { id: 'linked', label: 'Most linked' },
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

function normalizeWheelDelta(event) {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
  return event.deltaY;
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

function getRelationshipTone(note) {
  const links = note.links || [];
  const outgoing = links.filter((link) => link.source_note_id === note.id).length;
  const incoming = links.filter((link) => link.target_note_id === note.id).length;

  if (outgoing > 0 && incoming === 0) return { label: 'Parent', className: 'bg-sky-500/12 text-sky-700 ring-sky-500/20' };
  if (incoming > 0 && outgoing === 0) return { label: 'Child', className: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/20' };
  if (incoming > 0 && outgoing > 0) return { label: 'Hub', className: 'bg-violet-500/12 text-violet-700 ring-violet-500/20' };
  return null;
}

function getNotePlainText(note) {
  const sections = (note.sections || [])
    .map((section) => `${section.title || ''} ${section.content || ''}`)
    .join(' ');
  return `${note.title || ''} ${note.content || ''} ${sections} ${note.author_name || ''}`;
}

function getNoteSummary(note, maxLength = 92) {
  const text = getNotePlainText(note).replace(/\s+/g, ' ').trim();
  if (!text) return 'No text yet';
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function formatRelativeActivity(value) {
  if (!value) return 'No activity yet';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'No activity yet';
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Edited just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Edited ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Edited ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Edited ${days}d ago`;
  return `Edited ${new Date(value).toLocaleDateString()}`;
}

function connectionCount(note) {
  return (note.links || []).filter((link) => (
    link.source_note_id === note.id || link.target_note_id === note.id
  )).length;
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

function MergedNoteSection({
  section,
  images,
  isCollapsed,
  isDragging,
  onToggleCollapse,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  onUpdate,
  onUnmerge,
  onDeleteSection,
  onDeleteImage,
  onAddAnnotation,
  onDeleteAnnotation,
}) {
  const [title, setTitle] = useState(section.title);
  const [content, setContent] = useState(section.content);
  const [busyAction, setBusyAction] = useState('');
  const saveTimer = useRef(null);

  useEffect(() => setTitle(section.title), [section.title]);
  useEffect(() => setContent(section.content), [section.content]);
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  function scheduleUpdate(patch) {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onUpdate(section.id, patch), 600);
  }

  async function handleUnmerge() {
    if (!window.confirm(`Unmerge "${title || 'Untitled'}" into its own note?`)) return;
    setBusyAction('unmerge');
    try {
      await onUnmerge(section.id);
    } finally {
      setBusyAction('');
    }
  }

  async function handleDeleteSection() {
    if (!window.confirm(`Delete merged section "${title || 'Untitled'}"?`)) return;
    setBusyAction('delete');
    try {
      await onDeleteSection(section.id);
    } finally {
      setBusyAction('');
    }
  }

  return (
    <section
      className={`overflow-hidden rounded-xl border border-black/10 bg-white/55 transition-opacity dark:border-black/10 dark:bg-zinc-50/80 ${
        isDragging ? 'opacity-55 ring-2 ring-emerald-500/40' : ''
      }`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="border-b border-black/10 p-3 dark:border-black/10">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            draggable
            onDragStart={onDragStart}
            aria-label="Drag section"
            title="Drag section"
            className="flex h-7 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-zinc-400 hover:bg-black/5 hover:text-zinc-700 active:cursor-grabbing"
          >
            <GripIcon />
          </button>
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
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 transition-colors hover:bg-white"
          >
            {isCollapsed ? 'Expand' : 'Collapse'}
          </button>
          <div className="flex rounded-full border border-black/10 bg-white/70 p-0.5">
            <button
              type="button"
              onClick={onMoveUp}
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-zinc-500 hover:bg-white hover:text-zinc-900"
              aria-label="Move section up"
              title="Move up"
            >
              Up
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-zinc-500 hover:bg-white hover:text-zinc-900"
              aria-label="Move section down"
              title="Move down"
            >
              Down
            </button>
          </div>
          <button
            type="button"
            onClick={handleUnmerge}
            disabled={Boolean(busyAction)}
            className="rounded-full border border-black/10 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-60"
          >
            {busyAction === 'unmerge' ? 'Unmerging...' : 'Unmerge'}
          </button>
          <button
            type="button"
            onClick={handleDeleteSection}
            disabled={Boolean(busyAction)}
            className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-600 transition-colors hover:bg-red-100 disabled:cursor-wait disabled:opacity-60"
          >
            {busyAction === 'delete' ? 'Deleting...' : 'Delete part'}
          </button>
        </div>
        {isCollapsed ? (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-500">
            {content?.trim() || 'No text in this section yet.'}
          </p>
        ) : (
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
        )}
      </div>
      {!isCollapsed && images.length > 0 && (
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
  linkedFrom = [],
  linksTo = [],
  activityLabel,
  focusActive,
  isDimmed,
  isMoving,
  isMergeTarget,
  desktopMergeEnabled,
  isLinking,
  onMoveStart,
  onLinkStart,
  onZoomToNote,
  onJumpToNote,
  onFocusNote,
  onHoverLinkedNote,
  onUpdate,
  onUpdateSection,
  onReorderSections,
  onUnmergeSection,
  onDeleteSection,
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
  const [collapsedSectionIds, setCollapsedSectionIds] = useState(() => new Set());
  const [draggingSectionId, setDraggingSectionId] = useState('');
  const [previewNote, setPreviewNote] = useState(null);
  const saveTimer = useRef(null);
  const fileInput = useRef(null);
  const zoomIntentRef = useRef(null);
  const noteColor = note.color || '#ffffff';
  const relationshipTone = getRelationshipTone(note);
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
  const linkedNotes = [...linkedFrom, ...linksTo];

  useEffect(() => setTitle(note.title), [note.title]);
  useEffect(() => setContent(note.content), [note.content]);
  useEffect(() => {
    setCollapsedSectionIds((current) => {
      const available = new Set(sections.map((section) => section.id));
      const next = new Set([...current].filter((id) => available.has(id)));
      return next;
    });
  }, [sections]);
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

  function toggleSectionCollapse(sectionId) {
    setCollapsedSectionIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  function reorderSection(sectionId, targetSectionId) {
    if (!onReorderSections || sectionId === targetSectionId) return;
    const currentIds = sections.map((section) => section.id);
    const from = currentIds.indexOf(sectionId);
    const to = currentIds.indexOf(targetSectionId);
    if (from < 0 || to < 0) return;
    const nextIds = [...currentIds];
    const [moved] = nextIds.splice(from, 1);
    nextIds.splice(to, 0, moved);
    onReorderSections(note.id, nextIds);
  }

  function moveSection(sectionId, direction) {
    if (!onReorderSections) return;
    const currentIds = sections.map((section) => section.id);
    const index = currentIds.indexOf(sectionId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= currentIds.length) return;
    const nextIds = [...currentIds];
    [nextIds[index], nextIds[nextIndex]] = [nextIds[nextIndex], nextIds[index]];
    onReorderSections(note.id, nextIds);
  }

  function renderLinkedNoteChip(item, direction) {
    const linkedNote = item.note;
    if (!linkedNote) return null;
    return (
      <button
        key={`${direction}:${linkedNote.id}`}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onJumpToNote?.(linkedNote.id);
        }}
        onMouseEnter={() => {
          setPreviewNote(linkedNote);
          onHoverLinkedNote?.(linkedNote.id);
        }}
        onMouseLeave={() => {
          setPreviewNote(null);
          onHoverLinkedNote?.('');
        }}
        className={`max-w-full truncate rounded-full border px-2 py-1 text-[10px] font-semibold transition-colors ${
          direction === 'from'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
        }`}
        title={`${direction === 'from' ? 'Linked from' : 'Links to'} ${linkedNote.title || 'Untitled'}`}
      >
        {direction === 'from' ? 'From ' : 'To '}
        {linkedNote.title || 'Untitled'}
      </button>
    );
  }

  return (
    <div
      className={`group relative flex flex-col gap-3 rounded-[22px] border bg-white/96 p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.55)] transition-all duration-200 hover:shadow-[0_24px_52px_-28px_rgba(15,23,42,0.65)] dark:bg-white/96 ${
        isImageDragging
          ? 'border-blue-500 ring-4 ring-blue-500/20 dark:border-blue-400'
          : isMoving
            ? 'border-zinc-300 shadow-[0_20px_44px_-26px_rgba(15,23,42,0.55)] dark:border-zinc-300'
            : isMergeTarget
              ? 'border-violet-500 ring-4 ring-violet-500/25 dark:border-violet-400'
            : 'border-white/70 dark:border-zinc-300'
      } ${focusActive && isDimmed ? 'opacity-25 saturate-75' : 'opacity-100'} ${desktopMergeEnabled ? 'note-card-scroll h-full overflow-auto' : ''}`}
      style={{ background: noteColor === '#ffffff' ? 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(248,250,252,0.94) 100%)' : `linear-gradient(180deg, color-mix(in srgb, ${noteColor} 88%, white 12%) 0%, color-mix(in srgb, ${noteColor} 76%, white 24%) 100%)` }}
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
      {previewNote && (
        <div className="pointer-events-none absolute left-4 right-4 top-16 z-30 rounded-xl border border-zinc-200 bg-white/96 p-3 text-left shadow-xl shadow-zinc-900/10 dark:border-zinc-300 dark:bg-white/96">
          <p className="truncate text-xs font-semibold text-zinc-950">{previewNote.title || 'Untitled'}</p>
          <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-zinc-600">{getNoteSummary(previewNote, 150)}</p>
          <p className="mt-2 text-[10px] font-medium uppercase text-zinc-400">{formatRelativeActivity(previewNote.updated_at)}</p>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-[22px] bg-gradient-to-b from-white/22 to-transparent" />
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
      <div className="flex min-w-0 items-start gap-2 border-b border-black/8 pb-3">
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
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <input
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold tracking-tight text-zinc-950 outline-none placeholder:text-zinc-500 dark:text-zinc-950 dark:placeholder:text-zinc-500"
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
            {relationshipTone && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${relationshipTone.className}`}>
                {relationshipTone.label}
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
            {note.author_name || 'Note'}
          </p>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onFocusNote?.(note.id);
          }}
          aria-label={focusActive ? 'Clear focus' : 'Focus note'}
          title={focusActive ? 'Clear focus' : 'Focus note and linked notes'}
          className={`mt-0.5 hidden h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors lg:flex ${
            focusActive && !isDimmed
              ? 'bg-zinc-950 text-white'
              : 'text-zinc-400 hover:bg-black/5 hover:text-zinc-800'
          }`}
        >
          F
        </button>
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
      {linkedNotes.length > 0 && (
        <div className="relative grid gap-1 rounded-2xl bg-white/26 px-2 py-2 ring-1 ring-black/6">
          {linkedFrom.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <span className="shrink-0 text-[10px] font-semibold uppercase text-zinc-500">Backlinks</span>
              {linkedFrom.slice(0, 3).map((item) => renderLinkedNoteChip(item, 'from'))}
            </div>
          )}
          {linksTo.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <span className="shrink-0 text-[10px] font-semibold uppercase text-zinc-500">Links</span>
              {linksTo.slice(0, 3).map((item) => renderLinkedNoteChip(item, 'to'))}
            </div>
          )}
        </div>
      )}
      <div className="sticky top-0 z-20 flex w-full shrink-0 items-center justify-between gap-3 overflow-visible">
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-white/88 px-1.5 py-1 shadow-sm ring-1 ring-black/10 backdrop-blur">
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
          <div className="flex items-center gap-1 rounded-full bg-white/56 px-1 py-1 ring-1 ring-black/8 backdrop-blur">
            <button
              onClick={() => onUpdate(note.id, { is_pinned: !note.is_pinned })}
              title={note.is_pinned ? 'Unpin' : 'Pin'}
              className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${
                note.is_pinned ? 'bg-zinc-950 text-white' : 'text-zinc-500 hover:bg-black/5 hover:text-zinc-900'
              }`}
            >
              Pin
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
            onClick={() => onUpdate(note.id, { is_archived: !note.is_archived })}
            aria-label={note.is_archived ? 'Restore note' : 'Archive note'}
            title={note.is_archived ? 'Restore note' : 'Archive note'}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded p-1 text-zinc-500 hover:bg-black/5 hover:text-zinc-900"
          >
            {note.is_archived ? 'R' : 'A'}
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Permanently delete "${title || 'Untitled'}"?`)) onDelete(note.id);
            }}
            aria-label="Delete note permanently"
            title="Delete permanently"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded p-1 text-red-500 hover:bg-red-500/10 hover:text-red-600"
          >
            <TrashIcon />
          </button>
      </div>
      </div>
      {sections.length === 0 && (
        <textarea
          className={`min-h-[96px] resize-none rounded-2xl bg-white/24 px-3 py-3 text-sm leading-6 text-zinc-700 outline-none ring-1 ring-black/6 placeholder:text-zinc-500 dark:text-zinc-700 dark:placeholder:text-zinc-500 ${
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
              isCollapsed={collapsedSectionIds.has(section.id)}
              isDragging={draggingSectionId === section.id}
              onToggleCollapse={() => toggleSectionCollapse(section.id)}
              onMoveUp={() => moveSection(section.id, -1)}
              onMoveDown={() => moveSection(section.id, 1)}
              onDragStart={(event) => {
                event.stopPropagation();
                setDraggingSectionId(section.id);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', section.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const sourceSectionId = event.dataTransfer.getData('text/plain') || draggingSectionId;
                setDraggingSectionId('');
                reorderSection(sourceSectionId, section.id);
              }}
              onUpdate={(sectionId, patch) => onUpdateSection(note.id, sectionId, patch)}
              onUnmerge={(sectionId) => onUnmergeSection(note.id, sectionId)}
              onDeleteSection={(sectionId) => onDeleteSection(note.id, sectionId)}
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
      <div className="mt-auto flex items-center gap-2 pt-1">
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
          className="rounded-full border border-black/10 bg-white/76 px-3 py-1.5 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-60"
        >
          {uploading ? 'Adding screenshot...' : '+ Screenshot'}
        </button>
        <span className="text-[10px] text-zinc-500">Drop or paste images</span>
      </div>
      {imageError && <p className="text-xs text-red-600 dark:text-red-400">{imageError}</p>}
      <div className="flex items-center justify-between border-t border-black/8 pt-2 text-[11px] text-zinc-500 dark:text-zinc-500">
        <span className="flex items-center gap-1">
          {note.is_private && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Private
            </span>
          )}
          {note.is_archived && (
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
              Archived
            </span>
          )}
          {note.author_name}
        </span>
        <span title={new Date(note.updated_at).toLocaleString()}>{activityLabel || new Date(note.updated_at).toLocaleDateString()}</span>
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
  currentUser,
  onCreate,
  onUpdate,
  onUpdateSection,
  onReorderSections,
  onUnmergeSection,
  onDeleteSection,
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
  const [viewFilter, setViewFilter] = useState('active');
  const [sortMode, setSortMode] = useState('manual');
  const [focusedNoteId, setFocusedNoteId] = useState('');
  const [hoveredNoteId, setHoveredNoteId] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
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
  const [zoomControlsOffset, setZoomControlsOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const boardRef = useRef(null);
  const scrollerRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const panRef = useRef(null);
  const linkRef = useRef(null);
  const zoomControlsDragRef = useRef(null);

  const noteById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  const allLinks = useMemo(() => {
    const unique = new Map();
    notes.forEach((note) => {
      (note.links || []).forEach((link) => {
        if (!unique.has(link.id)) unique.set(link.id, link);
      });
    });
    return [...unique.values()];
  }, [notes]);
  const linkedNoteIds = useMemo(() => {
    const ids = new Set();
    allLinks.forEach((link) => {
      ids.add(link.source_note_id);
      ids.add(link.target_note_id);
    });
    return ids;
  }, [allLinks]);
  const focusedLinkedIds = useMemo(() => {
    if (!focusedNoteId) return new Set();
    const ids = new Set([focusedNoteId]);
    allLinks.forEach((link) => {
      if (link.source_note_id === focusedNoteId) ids.add(link.target_note_id);
      if (link.target_note_id === focusedNoteId) ids.add(link.source_note_id);
    });
    return ids;
  }, [allLinks, focusedNoteId]);

  const filteredNotes = useMemo(() => {
    const term = query.trim().toLowerCase();
    return [...notes]
      .sort((a, b) => {
        if (sortMode === 'newest') return new Date(b.created_at) - new Date(a.created_at);
        if (sortMode === 'edited') return new Date(b.updated_at) - new Date(a.updated_at);
        if (sortMode === 'linked') return connectionCount(b) - connectionCount(a);
        if (sortMode === 'pinned' && a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        if ((a.sort_order ?? 0) !== (b.sort_order ?? 0)) return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        return new Date(b.updated_at) - new Date(a.updated_at);
      })
      .filter((note) => {
        if (viewFilter === 'active' && note.is_archived) return false;
        if (viewFilter === 'archived' && !note.is_archived) return false;
        if (viewFilter === 'pinned' && (!note.is_pinned || note.is_archived)) return false;
        if (viewFilter === 'private' && (!note.is_private || note.is_archived)) return false;
        if (viewFilter === 'linked' && (!linkedNoteIds.has(note.id) || note.is_archived)) return false;
        if (viewFilter === 'mine' && (note.created_by !== currentUser?.id || note.is_archived)) return false;
        if (!term) return true;
        return getNotePlainText(note).toLowerCase().includes(term);
      });
  }, [currentUser?.id, linkedNoteIds, notes, query, sortMode, viewFilter]);

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
      const zoomControlsDrag = zoomControlsDragRef.current;
      if (zoomControlsDrag && zoomControlsDrag.pointerId === e.pointerId) {
        setZoomControlsOffset({
          x: zoomControlsDrag.originX + (e.clientX - zoomControlsDrag.startX),
          y: zoomControlsDrag.originY + (e.clientY - zoomControlsDrag.startY),
        });
        return;
      }
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
      const zoomControlsDrag = zoomControlsDragRef.current;
      if (zoomControlsDrag && zoomControlsDrag.pointerId === e.pointerId) {
        zoomControlsDragRef.current = null;
        return;
      }
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

  function handleZoomControlsDragStart(event) {
    event.preventDefault();
    event.stopPropagation();
    zoomControlsDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: zoomControlsOffset.x,
      originY: zoomControlsOffset.y,
    };
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

  function jumpToNote(noteId) {
    setFocusedNoteId(noteId);
    if (desktopMergeEnabled && boardScale < 0.99) {
      setBoardScale(1);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => centerNoteInView(noteId));
      });
      return;
    }
    centerNoteInView(noteId);
  }

  function toggleFocusNote(noteId) {
    setFocusedNoteId((current) => (current === noteId ? '' : noteId));
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
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    event.preventDefault();
    const scrollerRect = scroller.getBoundingClientRect();
    const pointerOffsetX = event.clientX - scrollerRect.left;
    const pointerOffsetY = event.clientY - scrollerRect.top;
    const normalizedDelta = normalizeWheelDelta(event);
    if (!normalizedDelta) return;

    setBoardScale((current) => {
      const next = clampBoardScale(Number((current * Math.exp(-normalizedDelta * 0.001)).toFixed(3)));
      if (next === current) return current;

      const boardPointX = (scroller.scrollLeft + pointerOffsetX) / current;
      const boardPointY = (scroller.scrollTop + pointerOffsetY) / current;

      window.requestAnimationFrame(() => {
        scroller.scrollLeft = Math.max(0, (boardPointX * next) - pointerOffsetX);
        scroller.scrollTop = Math.max(0, (boardPointY * next) - pointerOffsetY);
      });

      return next;
    });
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

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === 'Escape') {
        setCommandOpen(false);
        setFocusedNoteId('');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const commandNotes = useMemo(() => {
    const term = commandQuery.trim().toLowerCase();
    return notes
      .filter((note) => !note.is_archived)
      .filter((note) => !term || getNotePlainText(note).toLowerCase().includes(term))
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 8);
  }, [commandQuery, notes]);

  async function runCommand(action, note) {
    setCommandOpen(false);
    if (action === 'create') {
      await onCreate();
      return;
    }
    if (!note) return;
    if (action === 'jump') jumpToNote(note.id);
    if (action === 'pin') await onUpdate(note.id, { is_pinned: !note.is_pinned });
    if (action === 'private') await onUpdate(note.id, { is_private: !note.is_private });
    if (action === 'archive') await onUpdate(note.id, { is_archived: true });
    if (action === 'focus') setFocusedNoteId(note.id);
  }

  function getLinkContext(note) {
    const linkedFrom = allLinks
      .filter((link) => link.target_note_id === note.id)
      .map((link) => ({ link, note: noteById.get(link.source_note_id) }))
      .filter((item) => item.note);
    const linksTo = allLinks
      .filter((link) => link.source_note_id === note.id)
      .map((link) => ({ link, note: noteById.get(link.target_note_id) }))
      .filter((item) => item.note);
    return { linkedFrom, linksTo };
  }

  function isNoteDimmed(noteId) {
    if (!focusedNoteId && !hoveredNoteId) return false;
    const activeId = hoveredNoteId || focusedNoteId;
    if (noteId === activeId) return false;
    if (hoveredNoteId) {
      return !allLinks.some((link) => (
        (link.source_note_id === activeId && link.target_note_id === noteId) ||
        (link.target_note_id === activeId && link.source_note_id === noteId)
      ));
    }
    return !focusedLinkedIds.has(noteId);
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
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
            className="rounded-lg bg-zinc-100 px-2 py-1.5 text-xs font-medium text-zinc-700 outline-none focus:ring-1 focus:ring-zinc-400 dark:bg-[#2a374c] dark:text-zinc-100"
            aria-label="Sort notes"
            title="Sort notes"
          >
            {SORT_MODES.map((mode) => (
              <option key={mode.id} value={mode.id}>{mode.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-[#2a374c] dark:text-zinc-100 dark:hover:bg-[#344158]"
            title="Command palette"
          >
            Cmd
          </button>
          <AiNoteAssistant onCreate={onCreate} onUpdate={onUpdate} />
          <button
            onClick={() => onCreate()}
            className="hidden rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 sm:block dark:bg-emerald-500 dark:hover:bg-emerald-400"
          >
            + New note
          </button>
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5">
          {VIEW_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setViewFilter(filter.id)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                viewFilter === filter.id
                  ? 'bg-zinc-950 text-white dark:bg-emerald-500 dark:text-white'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:bg-[#2a374c] dark:text-slate-300 dark:hover:bg-[#344158] dark:hover:text-white'
              }`}
            >
              {filter.label}
            </button>
          ))}
          {focusedNoteId && (
            <button
              type="button"
              onClick={() => setFocusedNoteId('')}
              className="ml-auto shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
            >
              Clear focus
            </button>
          )}
        </div>
      </header>
      {commandOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/35 px-4 pt-24 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-950/20 dark:border-slate-600 dark:bg-[#202c40]">
            <div className="border-b border-zinc-200 p-3 dark:border-slate-600">
              <input
                autoFocus
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="Jump, create, focus, pin, archive..."
                className="w-full bg-transparent text-sm font-medium text-zinc-950 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
              />
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2">
              <button
                type="button"
                onClick={() => runCommand('create')}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
              >
                <span>Create new note</span>
                <span className="text-xs text-emerald-500">New</span>
              </button>
              {commandNotes.map((note) => (
                <div key={note.id} className="rounded-xl px-2 py-2 hover:bg-zinc-50 dark:hover:bg-[#2a374c]">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => runCommand('jump', note)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-100">{note.title || 'Untitled'}</p>
                      <p className="truncate text-xs text-zinc-500 dark:text-slate-400">{getNoteSummary(note, 110)}</p>
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => runCommand('focus', note)} className="rounded-full px-2 py-1 text-[10px] font-semibold text-zinc-500 hover:bg-zinc-100 dark:text-slate-300 dark:hover:bg-[#344158]">Focus</button>
                      <button type="button" onClick={() => runCommand('pin', note)} className="rounded-full px-2 py-1 text-[10px] font-semibold text-zinc-500 hover:bg-zinc-100 dark:text-slate-300 dark:hover:bg-[#344158]">Pin</button>
                      <button type="button" onClick={() => runCommand('archive', note)} className="rounded-full px-2 py-1 text-[10px] font-semibold text-zinc-500 hover:bg-zinc-100 dark:text-slate-300 dark:hover:bg-[#344158]">Archive</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-zinc-200 p-2 dark:border-slate-600">
              <button type="button" onClick={() => setCommandOpen(false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 dark:text-slate-300 dark:hover:bg-[#344158]">Close</button>
            </div>
          </div>
        </div>
      )}
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
              <div
                className="absolute right-3 top-3 z-30 flex items-center gap-1 rounded-full bg-white/92 p-1 shadow-sm ring-1 ring-zinc-200 backdrop-blur dark:bg-[#202c40]/92 dark:ring-slate-600"
                style={{ transform: `translate(${zoomControlsOffset.x}px, ${zoomControlsOffset.y}px)` }}
              >
                <button
                  type="button"
                  onPointerDown={handleZoomControlsDragStart}
                  aria-label="Move zoom controls"
                  title="Move zoom controls"
                  className="flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing dark:text-zinc-300 dark:hover:bg-[#344158] dark:hover:text-white"
                >
                  <GripIcon />
                </button>
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
                    <>
                      <path
                        key={`${link.id}:glow`}
                        d={getLinkPath(start, end)}
                        className="pointer-events-none fill-none stroke-slate-400/30 stroke-[9]"
                      />
                      <path
                        key={link.id}
                        d={getLinkPath(start, end)}
                        className="pointer-events-auto cursor-pointer fill-none stroke-slate-500 stroke-[2.5] transition-colors hover:stroke-emerald-500"
                        markerEnd="url(#note-link-arrow)"
                        onClick={(event) => {
                          event.stopPropagation();
                          const confirmed = window.confirm('Delete this note connection?');
                          if (confirmed) onDeleteLink(link.source_note_id, link.id);
                        }}
                      />
                    </>
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
                  {filteredNotes.map((note) => {
                    const linkContext = getLinkContext(note);
                    const dimmed = isNoteDimmed(note.id);
                    return (
                      <div
                        key={note.id}
                        data-note-id={note.id}
                        className="absolute z-10 transition-opacity"
                        style={{
                          width: sizes[note.id]?.width || DEFAULT_NOTE_SIZE.width,
                          height: sizes[note.id]?.height || DEFAULT_NOTE_SIZE.height,
                          transform: `translate3d(${positions[note.id]?.x || 0}px, ${positions[note.id]?.y || 0}px, 0)`,
                          zIndex: movingNoteId === note.id || resizingNoteId === note.id || focusedNoteId === note.id ? 20 : note.is_pinned ? 5 : 1,
                        }}
                      >
                        <NoteCard
                          note={note}
                          linkedFrom={linkContext.linkedFrom}
                          linksTo={linkContext.linksTo}
                          activityLabel={formatRelativeActivity(note.updated_at)}
                          focusActive={Boolean(focusedNoteId)}
                          isDimmed={dimmed}
                          isMoving={movingNoteId === note.id}
                          isMergeTarget={mergeTargetId === note.id}
                          isLinking={linkingNoteId === note.id}
                          desktopMergeEnabled={desktopMergeEnabled && !query.trim()}
                          onMoveStart={handleMoveStart}
                          onLinkStart={handleLinkStart}
                          onZoomToNote={handleZoomToNote}
                          onJumpToNote={jumpToNote}
                          onFocusNote={toggleFocusNote}
                          onHoverLinkedNote={setHoveredNoteId}
                          onResizeStart={handleResizeStart}
                          onUpdate={onUpdate}
                          onUpdateSection={onUpdateSection}
                          onReorderSections={onReorderSections}
                          onUnmergeSection={onUnmergeSection}
                          onDeleteSection={onDeleteSection}
                          onDelete={onDelete}
                          onAddImage={onAddImage}
                          onDeleteImage={onDeleteImage}
                          onAddAnnotation={onAddAnnotation}
                          onDeleteAnnotation={onDeleteAnnotation}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              {!desktopMergeEnabled && filteredNotes.map((note) => {
                const linkContext = getLinkContext(note);
                return (
                  <div key={note.id}>
                    <NoteCard
                      note={note}
                      linkedFrom={linkContext.linkedFrom}
                      linksTo={linkContext.linksTo}
                      activityLabel={formatRelativeActivity(note.updated_at)}
                      focusActive={Boolean(focusedNoteId)}
                      isDimmed={isNoteDimmed(note.id)}
                      isMoving={movingNoteId === note.id}
                      isMergeTarget={mergeTargetId === note.id}
                      isLinking={linkingNoteId === note.id}
                      desktopMergeEnabled={false}
                      onMoveStart={handleMoveStart}
                      onLinkStart={handleLinkStart}
                      onZoomToNote={handleZoomToNote}
                      onJumpToNote={jumpToNote}
                      onFocusNote={toggleFocusNote}
                      onHoverLinkedNote={setHoveredNoteId}
                      onResizeStart={handleResizeStart}
                      onUpdate={onUpdate}
                      onUpdateSection={onUpdateSection}
                      onReorderSections={onReorderSections}
                      onUnmergeSection={onUnmergeSection}
                      onDeleteSection={onDeleteSection}
                      onDelete={onDelete}
                      onAddImage={onAddImage}
                      onDeleteImage={onDeleteImage}
                      onAddAnnotation={onAddAnnotation}
                      onDeleteAnnotation={onDeleteAnnotation}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
