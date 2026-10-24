import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const models = {
  courses: prisma.course,
  semesters: prisma.semester,
  subjects: prisma.subject,
  units: prisma.unit,
} as const;

type Resource = keyof typeof models;
type Payload = Record<string, unknown>;

function delegate(resource: string) {
  if (!(resource in models)) return null;
  return models[resource as Resource];
}

function clean(resource: Resource, body: Payload) {
  if (resource === "courses") return { name: body.name, code: body.code || null };
  if (resource === "semesters") return { number: Number(body.number), courseId: body.courseId };
  if (resource === "subjects") return { name: body.name, code: body.code || null, semesterId: body.semesterId };
  return { name: body.name, number: Number(body.number), subjectId: body.subjectId };
}

async function validateParent(resource: Resource, body: Payload) {
  if (resource === "semesters") {
    if (!body.courseId || !(await prisma.course.findUnique({ where: { id: String(body.courseId) } })))
      return "Select an existing course.";
    const n = Number(body.number);
    if (!Number.isInteger(n) || n < 1 || n > 8) return "Semester number must be between 1 and 8.";
  }
  if (resource === "subjects") {
    if (!body.semesterId || !(await prisma.semester.findUnique({ where: { id: String(body.semesterId) } })))
      return "Select an existing semester.";
  }
  if (resource === "units") {
    if (!body.subjectId || !(await prisma.subject.findUnique({ where: { id: String(body.subjectId) } })))
      return "Select an existing subject.";
    const n = Number(body.number);
    if (!Number.isInteger(n) || n < 1) return "Unit number must be a positive integer.";
  }
  if (resource === "courses" && !String(body.name ?? "").trim()) return "Course name is required.";
  if (resource === "subjects" && !String(body.name ?? "").trim()) return "Subject name is required.";
  if (resource === "units" && !String(body.name ?? "").trim()) return "Unit name is required.";
  return null;
}

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource: key } = await context.params;
  const model = delegate(key);
  if (!model) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
  const { searchParams } = new URL(request.url);
  const parent = searchParams.get("parentId");
  const where =
    key === "semesters" && parent ? { courseId: parent } :
    key === "subjects" && parent ? { semesterId: parent } :
    key === "units" && parent ? { subjectId: parent } : {};
  try {
    const rows = await model.findMany({ where, orderBy: key === "courses" ? { name: "asc" } : { number: "asc" } });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Could not load records. Check the database connection." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource: key } = await context.params;
  const model = delegate(key);
  if (!model) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
  try {
    const body = await request.json() as Payload;
    const error = await validateParent(key as Resource, body);
    if (error) return NextResponse.json({ error }, { status: 400 });
    const row = await model.create({ data: clean(key as Resource, body) });
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("Unique constraint")
      ? "That record already exists."
      : "Could not create record. Check the supplied values and database connection.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource: key } = await context.params;
  const model = delegate(key);
  if (!model) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
  try {
    const body = await request.json() as Payload;
    if (!body.id) return NextResponse.json({ error: "Record id is required." }, { status: 400 });
    const error = await validateParent(key as Resource, body);
    if (error) return NextResponse.json({ error }, { status: 400 });
    const row = await model.update({ where: { id: String(body.id) }, data: clean(key as Resource, body) });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "Could not update record. It may no longer exist." }, { status: 404 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource: key } = await context.params;
  const model = delegate(key);
  if (!model) return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Record id is required." }, { status: 400 });
  try {
    await model.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Could not delete record. Remove dependent records first." }, { status: 409 });
  }
}
