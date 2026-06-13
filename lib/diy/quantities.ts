import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { ElementDims } from "./types";

type Token =
  | { type: "number"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "ident"; value: string };

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < formula.length) {
    const ch = formula[i];
    if (ch === " ") { i++; continue; }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ type: "op", value: ch as "+" | "-" | "*" | "/" });
      i++;
    } else if ((ch >= "0" && ch <= "9") || ch === ".") {
      let num = "";
      while (i < formula.length && ((formula[i] >= "0" && formula[i] <= "9") || formula[i] === ".")) {
        num += formula[i++];
      }
      tokens.push({ type: "number", value: parseFloat(num) });
    } else if ((ch >= "a" && ch <= "z") || ch === "_") {
      let ident = "";
      while (i < formula.length && ((formula[i] >= "a" && formula[i] <= "z") || formula[i] === "_" || (formula[i] >= "0" && formula[i] <= "9"))) {
        ident += formula[i++];
      }
      tokens.push({ type: "ident", value: ident });
    } else {
      i++;
    }
  }
  return tokens;
}

type ParseState = { tokens: Token[]; pos: number };

function peek(state: ParseState): Token | undefined {
  return state.tokens[state.pos];
}

function consume(state: ParseState): Token {
  return state.tokens[state.pos++];
}

function parseAtom(state: ParseState, dims: ElementDims): number {
  const t = peek(state);
  if (!t) throw new Error("Unexpected end of formula");
  if (t.type === "number") {
    consume(state);
    return t.value;
  }
  if (t.type === "ident") {
    consume(state);
    const val = (dims as Record<string, number | undefined>)[t.value];
    if (val === undefined) {
      throw new Error(`Unknown variable in formula: ${t.value}`);
    }
    return val;
  }
  throw new Error(`Unexpected token: ${JSON.stringify(t)}`);
}

function parseTerm(state: ParseState, dims: ElementDims): number {
  let left = parseAtom(state, dims);
  while (true) {
    const t = peek(state);
    if (!t || t.type !== "op" || (t.value !== "*" && t.value !== "/")) break;
    consume(state);
    const right = parseAtom(state, dims);
    if (t.value === "*") left *= right;
    else if (right === 0) throw new Error("Division by zero in formula");
    else left /= right;
  }
  return left;
}

function parseExpr(state: ParseState, dims: ElementDims): number {
  let left = parseTerm(state, dims);
  while (true) {
    const t = peek(state);
    if (!t || t.type !== "op" || (t.value !== "+" && t.value !== "-")) break;
    consume(state);
    const right = parseTerm(state, dims);
    if (t.value === "+") left += right;
    else left -= right;
  }
  return left;
}

export function evalQtyFormula(formula: string, dims: ElementDims): number {
  const tokens = tokenize(formula);
  const state: ParseState = { tokens, pos: 0 };
  const result = parseExpr(state, dims);
  if (state.pos < state.tokens.length) {
    throw new Error(`Unexpected tokens after formula: ${formula}`);
  }
  if (!isFinite(result) || isNaN(result)) {
    throw new Error(`Formula evaluated to invalid number: ${formula}`);
  }
  return Math.round(result * 100) / 100;
}

export async function getStandardDims(category: string): Promise<ElementDims | null> {
  const normalised = category.toLowerCase().replace(/\s+/g, "_");
  const { data } = await createSupabaseAdmin()
    .from("assets")
    .select("data")
    .eq("category", "standard_dims")
    .eq("slug", normalised)
    .single();

  if (!data) return null;
  return data.data as ElementDims;
}
