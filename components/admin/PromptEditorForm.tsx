"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { CodeTextarea } from "./CodeTextarea";
import { JsonEditor } from "./JsonEditor";
import { VersionsList, type PromptVersion } from "./VersionsList";
import { TestDrawer } from "./TestDrawer";
import type { PromptInput } from "@/lib/admin/actions";
import { createPrompt, updatePrompt, togglePromptActive } from "@/lib/admin/actions";

const PURPOSES = ["generation", "iteration", "vision", "detection", "audit"] as const;

const PROVIDERS_BY_PURPOSE: Record<string, string[]> = {
  generation: ["nano_banana", "flux_kontext"],
  iteration: ["nano_banana", "flux_kontext"],
  vision: ["gemini_vision"],
  detection: ["gemini_vision"],
  audit: ["gemini_vision"],
};

type Props = {
  promptId?: string;
  defaultValues?: Partial<PromptInput>;
  versions?: PromptVersion[];
  currentVersion?: number;
};

export function PromptEditorForm({
  promptId,
  defaultValues,
  versions = [],
  currentVersion = 0,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [slug, setSlug] = useState(defaultValues?.slug ?? "");
  const [purpose, setPurpose] = useState<string>(defaultValues?.purpose ?? "generation");
  const [provider, setProvider] = useState(
    defaultValues?.provider ?? PROVIDERS_BY_PURPOSE["generation"][0],
  );
  const [conditions, setConditions] = useState<Record<string, unknown>>(
    (defaultValues?.conditions as Record<string, unknown>) ?? {},
  );
  const [template, setTemplate] = useState(defaultValues?.template ?? "");
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");
  const [isActive, setIsActive] = useState(defaultValues?.is_active ?? true);
  const [testOpen, setTestOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePurposeChange(p: string) {
    setPurpose(p);
    const providers = PROVIDERS_BY_PURPOSE[p] ?? [];
    if (!providers.includes(provider)) {
      setProvider(providers[0] ?? "");
    }
  }

  function handleRestore(v: PromptVersion) {
    setTemplate(v.template);
    setConditions(v.conditions as Record<string, unknown>);
    setProvider(v.provider);
    setNotes(v.notes ?? "");
  }

  function handleSave() {
    setError(null);
    const input: PromptInput = {
      slug,
      purpose,
      provider,
      conditions,
      template,
      notes,
      is_active: isActive,
    };

    startTransition(async () => {
      try {
        if (promptId) {
          await updatePrompt(promptId, input);
          router.refresh();
        } else {
          const created = await createPrompt(input);
          router.push(`/admin/prompts/${created.id}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde.");
      }
    });
  }

  async function handleToggleActive() {
    if (!promptId) return;
    startTransition(async () => {
      await togglePromptActive(promptId, !isActive);
      setIsActive((v) => !v);
    });
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {promptId ? (
            <h1 className="font-serif text-2xl text-foyer-ink">
              {slug || "…"}
              <span className="ml-3 text-sm font-sans font-normal text-foyer-muted">
                v{currentVersion + 1} après sauvegarde
              </span>
            </h1>
          ) : (
            <h1 className="font-serif text-2xl text-foyer-ink">Nouveau prompt</h1>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => setTestOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-foyer-border px-3.5 py-2 text-sm text-foyer-ink hover:bg-foyer-border/30 transition-colors"
          >
            <FlaskConical size={15} />
            Tester
          </button>

          {promptId && (
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={isPending}
              className={`rounded-lg px-3.5 py-2 text-sm transition-colors disabled:opacity-40 ${
                isActive
                  ? "border border-foyer-terra/40 text-foyer-terra hover:bg-foyer-terra/5"
                  : "border border-foyer-sage/40 text-foyer-sage hover:bg-foyer-sage/5"
              }`}
            >
              {isActive ? "Désactiver" : "Activer"}
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !slug || !template}
            className="rounded-lg bg-foyer-ink text-foyer-cream px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
          >
            {isPending ? "Sauvegarde…" : "Sauvegarder"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-foyer-terra/10 border border-foyer-terra/30 px-4 py-3 text-sm text-foyer-terra">
          {error}
        </div>
      )}

      {/* Form grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Slug */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foyer-muted uppercase tracking-wide">
            Slug
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="gen_wow_generic"
            className="w-full rounded-lg border border-foyer-border bg-white px-3.5 py-2.5 text-sm font-mono text-foyer-ink outline-none focus:border-foyer-ink"
          />
        </div>

        {/* Purpose */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foyer-muted uppercase tracking-wide">
            Purpose
          </label>
          <select
            value={purpose}
            onChange={(e) => handlePurposeChange(e.target.value)}
            className="w-full rounded-lg border border-foyer-border bg-white px-3.5 py-2.5 text-sm text-foyer-ink outline-none focus:border-foyer-ink"
          >
            {PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Provider */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foyer-muted uppercase tracking-wide">
            Provider
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full rounded-lg border border-foyer-border bg-white px-3.5 py-2.5 text-sm text-foyer-ink outline-none focus:border-foyer-ink"
          >
            {(PROVIDERS_BY_PURPOSE[purpose] ?? []).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foyer-muted uppercase tracking-wide">
            Notes
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Description courte…"
            className="w-full rounded-lg border border-foyer-border bg-white px-3.5 py-2.5 text-sm text-foyer-ink outline-none focus:border-foyer-ink"
          />
        </div>
      </div>

      {/* Conditions */}
      <div className="rounded-lg border border-foyer-border p-4">
        <JsonEditor
          label="Conditions de match"
          value={conditions}
          onChange={setConditions}
        />
      </div>

      {/* Template */}
      <CodeTextarea
        label="Template"
        value={template}
        onChange={setTemplate}
        rows={14}
      />

      {/* is_active */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div
          onClick={() => setIsActive((v) => !v)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            isActive ? "bg-foyer-sage" : "bg-foyer-border"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
              isActive ? "translate-x-4" : "translate-x-1"
            }`}
          />
        </div>
        <span className="text-sm text-foyer-ink">Actif</span>
      </label>

      {/* Version history */}
      {versions.length > 0 && (
        <VersionsList versions={versions} onRestore={handleRestore} />
      )}

      {/* Test drawer */}
      <TestDrawer
        open={testOpen}
        onClose={() => setTestOpen(false)}
        template={template}
        provider={provider}
        purpose={purpose}
      />
    </div>
  );
}
