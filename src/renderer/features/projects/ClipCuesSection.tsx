import { useState } from 'react';
import type { ClipCue } from '@shared/schemas/clipCues';
import {
  useClipCues,
  useGenerateClipCues,
  useUpdateClipCue,
  useDeleteClipCue,
  useAddClipCue,
} from '@renderer/hooks/useClipCues';
import { msToTimingString } from './timingFormatters';

type ClipCuesSectionProps = {
  candidateId: string;
  candidateDurationMs: number;
};

type CueRowProps = {
  cue: ClipCue;
  candidateId: string;
};

function CueRow({ cue, candidateId }: CueRowProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(cue.text);
  const [editStartMs, setEditStartMs] = useState(String(cue.startMs));
  const [editEndMs, setEditEndMs] = useState(String(cue.endMs));

  const update = useUpdateClipCue();
  const del = useDeleteClipCue();

  const parsedStart = parseInt(editStartMs, 10);
  const parsedEnd = parseInt(editEndMs, 10);
  const canSave =
    editText.trim().length > 0 &&
    editText.length <= 500 &&
    Number.isInteger(parsedStart) && parsedStart >= 0 &&
    Number.isInteger(parsedEnd) && parsedEnd > parsedStart;

  const handleSave = async () => {
    await update.mutateAsync({
      cueId: cue.id,
      candidateId,
      startMs: parsedStart,
      endMs: parsedEnd,
      text: editText.trim(),
    });
    setEditing(false);
  };

  const handleDelete = () => {
    void del.mutateAsync({ cueId: cue.id, candidateId });
  };

  return (
    <li data-testid="clip-cue-item" className="rounded border border-border p-2 space-y-1.5">
      <div className="flex items-start gap-2">
        <span className="shrink-0 w-5 text-xs text-muted-foreground font-mono text-right">
          {cue.sequenceIndex}
        </span>
        <div className="flex-1 min-w-0 space-y-1">
          {editing ? (
            <>
              <textarea
                data-testid="cue-text-input"
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                rows={2}
                maxLength={500}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                aria-label="Cue text"
              />
              <div className="flex gap-2 items-center">
                <label className="text-xs text-muted-foreground">
                  Start ms:
                  <input
                    data-testid="cue-start-ms-input"
                    type="number"
                    min={0}
                    step={100}
                    value={editStartMs}
                    onChange={(e) => setEditStartMs(e.target.value)}
                    className="ml-1 w-20 rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  End ms:
                  <input
                    data-testid="cue-end-ms-input"
                    type="number"
                    min={1}
                    step={100}
                    value={editEndMs}
                    onChange={(e) => setEditEndMs(e.target.value)}
                    className="ml-1 w-20 rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="update-cue-button"
                  className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-foreground bg-foreground px-2 text-xs font-medium text-background disabled:opacity-50"
                  disabled={!canSave || update.isPending}
                  onClick={() => void handleSave()}
                >
                  {update.isPending ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-2 text-xs hover:bg-muted"
                  onClick={() => {
                    setEditing(false);
                    setEditText(cue.text);
                    setEditStartMs(String(cue.startMs));
                    setEditEndMs(String(cue.endMs));
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs">{cue.text}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {msToTimingString(cue.startMs)} → {msToTimingString(cue.endMs)}
              </p>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-2 text-xs hover:bg-muted"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
            <button
              type="button"
              data-testid="delete-cue-button"
              className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-2 text-xs hover:bg-muted disabled:opacity-50"
              disabled={del.isPending}
              onClick={handleDelete}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

type AddCueFormProps = {
  candidateId: string;
  candidateDurationMs: number;
  onDone: () => void;
};

function AddCueForm({ candidateId, candidateDurationMs, onDone }: AddCueFormProps) {
  const [text, setText] = useState('');
  const [startMs, setStartMs] = useState('0');
  const [endMs, setEndMs] = useState(String(Math.min(3000, candidateDurationMs)));
  const add = useAddClipCue();

  const parsedStart = parseInt(startMs, 10);
  const parsedEnd = parseInt(endMs, 10);
  const canAdd =
    text.trim().length > 0 &&
    text.length <= 500 &&
    Number.isInteger(parsedStart) && parsedStart >= 0 &&
    Number.isInteger(parsedEnd) && parsedEnd > parsedStart;

  const handleAdd = async () => {
    await add.mutateAsync({ candidateId, startMs: parsedStart, endMs: parsedEnd, text: text.trim() });
    setText('');
    setStartMs('0');
    setEndMs(String(Math.min(3000, candidateDurationMs)));
    onDone();
  };

  return (
    <div className="rounded border border-border p-2 space-y-1.5">
      <p className="text-xs font-medium">New cue</p>
      <textarea
        data-testid="new-cue-text-input"
        className="w-full rounded border border-border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        rows={2}
        maxLength={500}
        placeholder="Cue text…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex gap-2 items-center">
        <label className="text-xs text-muted-foreground">
          Start ms:
          <input
            type="number"
            min={0}
            step={100}
            value={startMs}
            onChange={(e) => setStartMs(e.target.value)}
            className="ml-1 w-20 rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          End ms:
          <input
            type="number"
            min={1}
            step={100}
            value={endMs}
            onChange={(e) => setEndMs(e.target.value)}
            className="ml-1 w-20 rounded border border-border bg-background px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="add-cue-button"
          className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-foreground bg-foreground px-2 text-xs font-medium text-background disabled:opacity-50"
          disabled={!canAdd || add.isPending}
          onClick={() => void handleAdd()}
        >
          {add.isPending ? 'Adding…' : 'Add cue'}
        </button>
        <button
          type="button"
          className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-2 text-xs hover:bg-muted"
          onClick={onDone}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export const ClipCuesSection = ({ candidateId, candidateDurationMs }: ClipCuesSectionProps) => {
  const cuesQuery = useClipCues(candidateId);
  const generate = useGenerateClipCues();
  const [showAddForm, setShowAddForm] = useState(false);

  const cues = cuesQuery.data?.cues ?? [];

  return (
    <div data-testid="clip-cues-section" className="border-t border-border pt-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-label uppercase tracking-label text-muted-foreground">Subtitle Cues</p>
        <button
          type="button"
          data-testid="generate-cues-button"
          className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-2 text-xs hover:bg-muted disabled:opacity-50"
          disabled={generate.isPending}
          onClick={() => void generate.mutateAsync(candidateId)}
        >
          {generate.isPending ? 'Generating…' : cues.length > 0 ? 'Regenerate cues' : 'Generate cues'}
        </button>
      </div>

      {generate.error && (
        <p className="text-xs text-muted-foreground">
          {generate.error instanceof Error ? generate.error.message : 'Failed to generate cues.'}
        </p>
      )}

      {cuesQuery.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}

      {cues.length > 0 && (
        <ul className="space-y-1.5">
          {cues.map((cue) => (
            <CueRow key={cue.id} cue={cue} candidateId={candidateId} />
          ))}
        </ul>
      )}

      {cues.length === 0 && !cuesQuery.isLoading && (
        <p className="text-xs text-muted-foreground">No cues. Click "Generate cues" to extract from the subtitle file.</p>
      )}

      {showAddForm ? (
        <AddCueForm
          candidateId={candidateId}
          candidateDurationMs={candidateDurationMs}
          onDone={() => setShowAddForm(false)}
        />
      ) : (
        <button
          type="button"
          data-testid="show-add-cue-form-button"
          className="h-[var(--control-height)] rounded-[var(--radius-sm)] border border-border px-2 text-xs hover:bg-muted"
          onClick={() => setShowAddForm(true)}
        >
          + Add cue
        </button>
      )}
    </div>
  );
};
