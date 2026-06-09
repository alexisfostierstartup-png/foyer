import path from "path";
import { nanoid } from "nanoid";
import type { Project, RoomType } from "@/lib/types";
import { DATA_DIR, readJson, writeJson } from "@/lib/storage/fs";

const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");

async function readAll(): Promise<Project[]> {
  return readJson<Project[]>(PROJECTS_FILE, []);
}

async function writeAll(projects: Project[]): Promise<void> {
  await writeJson(PROJECTS_FILE, projects);
}

export async function listProjects(): Promise<Project[]> {
  return readAll();
}

export async function getProject(id: string): Promise<Project | null> {
  const projects = await readAll();
  return projects.find((p) => p.id === id) ?? null;
}

export async function createProject(
  roomType: RoomType,
  basePhotoUrl: string,
): Promise<Project> {
  const project: Project = {
    id: nanoid(),
    createdAt: new Date().toISOString(),
    roomType,
    basePhotoUrl,
    selectedStyleId: null,
    generatedRenderUrl: null,
    detectedFurniture: [],
    architecture: null,
    userConstraints: null,
  };
  const projects = await readAll();
  projects.push(project);
  await writeAll(projects);
  return project;
}

export async function updateProject(
  id: string,
  updates: Partial<Omit<Project, "id" | "createdAt">>,
): Promise<Project | null> {
  const projects = await readAll();
  const index = projects.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const updated = { ...projects[index], ...updates };
  projects[index] = updated;
  await writeAll(projects);
  return updated;
}
