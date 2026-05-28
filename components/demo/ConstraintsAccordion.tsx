"use client";

import { useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import { SlidersHorizontal, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/demo/primitives";
import {
  FURNITURE_ITEMS,
  FLOOR_PRESETS,
  PAINT_COLORS,
  MOLDING_STYLES,
  type UserChoices,
} from "@/components/demo/demo-types";
import type { FurnitureDecision } from "@/lib/types";

type Props = {
  choices: UserChoices;
  setChoices: Dispatch<SetStateAction<UserChoices>>;
};

const DECISIONS: { id: FurnitureDecision; label: string; active: string }[] = [
  { id: "keep", label: "Garder", active: "bg-foyer-sage text-white" },
  { id: "customize", label: "Customiser", active: "bg-foyer-ochre text-white" },
  { id: "replace", label: "Remplacer", active: "bg-foyer-terra text-white" },
];

function SubSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-foyer-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-3"
        aria-expanded={open}
      >
        <SectionLabel>{label}</SectionLabel>
        <ChevronDown
          className={cn(
            "size-4 text-foyer-muted transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-2 border-foyer-ink text-foyer-ink"
          : "border border-foyer-border text-foyer-muted hover:text-foyer-ink",
      )}
    >
      {children}
    </button>
  );
}

export function ConstraintsAccordion({ choices, setChoices }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-foyer-border bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <SlidersHorizontal className="size-5 shrink-0 text-foyer-ink" aria-hidden />
        <span className="flex-1">
          <span className="block font-medium text-foyer-ink">
            Ajouter des contraintes
          </span>
          <span className="block text-[13px] text-foyer-muted">
            Optionnel — par défaut, on imagine le projet pour vous.
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-foyer-muted transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="px-4 pb-2">
          {/* D.1 — Meubles */}
          <SubSection label="Instructions meubles">
            <ul className="flex flex-col gap-3">
              {FURNITURE_ITEMS.map((item) => (
                <li key={item} className="flex items-center justify-between gap-2">
                  <span className="text-[15px] text-foyer-ink">{item}</span>
                  <div className="flex gap-1">
                    {DECISIONS.map((d) => {
                      const isActive = choices.furniture[item] === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() =>
                            setChoices((c) => ({
                              ...c,
                              furniture: { ...c.furniture, [item]: d.id },
                            }))
                          }
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors",
                            isActive
                              ? d.active
                              : "border border-foyer-border text-foyer-muted",
                          )}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </SubSection>

          {/* D.2 — Sol */}
          <SubSection label="Sol">
            <div className="flex flex-col gap-2">
              <Radio
                checked={!choices.floor.change}
                onChange={() =>
                  setChoices((c) => ({ ...c, floor: { ...c.floor, change: false } }))
                }
                label="Garder le sol actuel"
              />
              <Radio
                checked={choices.floor.change}
                onChange={() =>
                  setChoices((c) => ({ ...c, floor: { ...c.floor, change: true } }))
                }
                label="Changer"
              />
              {choices.floor.change && (
                <div className="mt-2">
                  <div className="flex flex-wrap gap-2">
                    {FLOOR_PRESETS.map((p) => (
                      <Chip
                        key={p}
                        active={choices.floor.preset === p}
                        onClick={() =>
                          setChoices((c) => ({
                            ...c,
                            floor: { ...c.floor, preset: p },
                          }))
                        }
                      >
                        {p}
                      </Chip>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={choices.floor.note}
                    onChange={(e) =>
                      setChoices((c) => ({
                        ...c,
                        floor: { ...c.floor, note: e.target.value },
                      }))
                    }
                    placeholder="Autre précision…"
                    className="mt-2 w-full rounded-xl border border-foyer-border bg-white px-3 py-2 text-sm text-foyer-ink outline-none placeholder:text-foyer-muted focus:border-foyer-terra"
                  />
                  {choices.floor.preset === "Carrelage" && (
                    <p className="mt-2 text-[12px] text-foyer-muted">
                      On vous proposera des options durables dans la liste
                      d&apos;achat.
                    </p>
                  )}
                </div>
              )}
            </div>
          </SubSection>

          {/* D.3 — Murs */}
          <SubSection label="Murs">
            <div className="flex flex-col gap-3">
              <Checkbox
                checked={choices.walls.repaint}
                onChange={(v) =>
                  setChoices((c) => ({ ...c, walls: { ...c.walls, repaint: v } }))
                }
                label="Repeindre"
              />
              {choices.walls.repaint && (
                <div className="flex gap-2 pl-1">
                  {PAINT_COLORS.map((col) => (
                    <button
                      key={col.name}
                      type="button"
                      aria-label={col.name}
                      onClick={() =>
                        setChoices((c) => ({
                          ...c,
                          walls: { ...c.walls, paintColor: col.hex },
                        }))
                      }
                      className={cn(
                        "size-7 rounded-full border transition-all",
                        choices.walls.paintColor === col.hex
                          ? "border-2 border-foyer-ink"
                          : "border-foyer-border",
                      )}
                      style={{ backgroundColor: col.hex }}
                    />
                  ))}
                </div>
              )}

              <Checkbox
                checked={choices.walls.moldings}
                onChange={(v) =>
                  setChoices((c) => ({ ...c, walls: { ...c.walls, moldings: v } }))
                }
                label="Ajouter des moulures"
              />
              {choices.walls.moldings && (
                <div className="flex flex-wrap gap-2 pl-1">
                  {MOLDING_STYLES.map((m) => (
                    <Chip
                      key={m.id}
                      active={choices.walls.moldingStyle === m.id}
                      onClick={() =>
                        setChoices((c) => ({
                          ...c,
                          walls: { ...c.walls, moldingStyle: m.id },
                        }))
                      }
                    >
                      {m.label}
                    </Chip>
                  ))}
                </div>
              )}

              <Checkbox
                checked={choices.walls.frames}
                onChange={(v) =>
                  setChoices((c) => ({ ...c, walls: { ...c.walls, frames: v } }))
                }
                label="Ajouter des cadres"
              />
            </div>
          </SubSection>

          {/* D.4 — Accessoires */}
          <SubSection label="Accessoires">
            <div className="flex flex-col gap-2">
              <Radio
                checked={choices.accessories === "cosy"}
                onChange={() =>
                  setChoices((c) => ({ ...c, accessories: "cosy" }))
                }
                label="Avec, ambiance cosy"
              />
              <Radio
                checked={choices.accessories === "epure"}
                onChange={() =>
                  setChoices((c) => ({ ...c, accessories: "epure" }))
                }
                label="Sans, rester épuré"
              />
              <p className="text-[12px] text-foyer-muted">plaid, plantes, coussins</p>
            </div>
          </SubSection>
        </div>
      )}
    </div>
  );
}

function Radio({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex items-center gap-2.5 text-left"
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-full border",
          checked ? "border-foyer-ink" : "border-foyer-border",
        )}
      >
        {checked && <span className="size-2 rounded-full bg-foyer-ink" />}
      </span>
      <span className="text-[15px] text-foyer-ink">{label}</span>
    </button>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-left"
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-[5px] border",
          checked ? "border-foyer-ink bg-foyer-ink text-white" : "border-foyer-border",
        )}
      >
        {checked && <Check className="size-3" aria-hidden />}
      </span>
      <span className="text-[15px] text-foyer-ink">{label}</span>
    </button>
  );
}
