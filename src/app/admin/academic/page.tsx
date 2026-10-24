"use client";

import { useCallback, useEffect, useState } from "react";

type Kind = "courses" | "semesters" | "subjects" | "units";
type Row = { id: string; name?: string; code?: string | null; number?: number; courseId?: string; semesterId?: string; subjectId?: string };
const labels: Record<Kind, string> = { courses: "Courses", semesters: "Semesters", subjects: "Subjects", units: "Units" };
const fields: Record<Kind, { key: string; label: string; type?: string }[]> = {
  courses: [{ key: "name", label: "Course name" }, { key: "code", label: "Course code (optional)" }],
  semesters: [{ key: "number", label: "Semester number", type: "number" }, { key: "courseId", label: "Course", type: "select" }],
  subjects: [{ key: "name", label: "Subject name" }, { key: "code", label: "Subject code (optional)" }, { key: "semesterId", label: "Semester", type: "select" }],
  units: [{ key: "name", label: "Unit name" }, { key: "number", label: "Unit number", type: "number" }, { key: "subjectId", label: "Subject", type: "select" }],
};

export default function AcademicAdmin() {
  const [kind, setKind] = useState<Kind>("courses");
  const [rows, setRows] = useState<Row[]>([]);
  const [courses, setCourses] = useState<Row[]>([]);
  const [semesters, setSemesters] = useState<Row[]>([]);
  const [subjects, setSubjects] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/admin/academic/${kind}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load records.");
      setRows(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load records."); }
  }, [kind]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    void Promise.all(["courses", "semesters", "subjects"].map(async (k) => {
      const r = await fetch(`/api/admin/academic/${k}`);
      return [k, await r.json()] as const;
    })).then((all) => {
      for (const [k, data] of all) {
        if (!Array.isArray(data)) continue;
        if (k === "courses") setCourses(data);
        if (k === "semesters") setSemesters(data);
        if (k === "subjects") setSubjects(data);
      }
    }).catch(() => {});
  }, []);

  const startNew = () => { setEditing(null); setForm({}); setError(""); };
  const startEdit = (row: Row) => {
    setEditing(row);
    setForm(Object.fromEntries(fields[kind].map(({ key }) => [key, String(row[key as keyof Row] ?? "")])));
    setError("");
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    const body: Record<string, unknown> = { ...form };
    if (fields[kind].some(f => f.key === "number")) body.number = Number(form.number);
    if (editing) body.id = editing.id;
    try {
      const response = await fetch(`/api/admin/academic/${kind}`, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Save failed.");
      startNew(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); }
    finally { setBusy(false); }
  };
  const remove = async (row: Row) => {
    if (!confirm(`Delete this ${kind.slice(0, -1)}? Related records may prevent deletion.`)) return;
    setError("");
    const response = await fetch(`/api/admin/academic/${kind}?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Delete failed."); else await load();
  };
  const options = (key: string): Row[] => key === "courseId" ? courses : key === "semesterId" ? semesters : subjects;
  const optionLabel = (row: Row, key: string) => key === "courseId" ? row.name ?? row.id : key === "semesterId" ? `Semester ${row.number}` : row.name ?? row.id;

  return <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100 sm:px-10">
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-xs font-semibold uppercase tracking-[.25em] text-cyan-300">QuantX · Admin</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Academic structure</h1>
          <p className="mt-2 text-slate-400">Manage courses, semesters, subjects and units.</p></div>
        <button onClick={startNew} className="rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200">+ Add {kind.slice(0, -1)}</button>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Academic resource type">
        {(Object.keys(labels) as Kind[]).map(k => <button key={k} onClick={() => { setKind(k); startNew(); }}
          className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${kind === k ? "border-cyan-300 bg-cyan-300/10 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>{labels[k]}</button>)}
      </nav>
      {error && <div role="alert" className="mb-5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-rose-200">{error}</div>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><h2 className="font-semibold">{labels[kind]}</h2><span className="text-sm text-slate-500">{rows.length} records</span></div>
          {rows.length === 0 ? <p className="px-5 py-12 text-center text-slate-400">No records yet. Add one to get started.</p> :
            <div className="divide-y divide-slate-800">{rows.map(row => <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div><p className="font-medium">{kind === "semesters" ? `Semester ${row.number}` : kind === "units" ? `Unit ${row.number}: ${row.name}` : row.name}</p>
                {row.code && <p className="mt-1 text-sm text-slate-400">{row.code}</p>}
                <p className="mt-1 max-w-xl truncate text-xs text-slate-500">ID: {row.id}</p></div>
              <div className="flex gap-2"><button onClick={() => startEdit(row)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">Edit</button>
                <button onClick={() => void remove(row)} className="rounded-lg border border-rose-500/30 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10">Delete</button></div>
            </article>)}</div>}
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="mb-1 text-lg font-semibold">{editing ? "Edit record" : `New ${kind.slice(0, -1)}`}</h2>
          <p className="mb-5 text-sm text-slate-400">Fields marked by their label are required unless noted optional.</p>
          <form onSubmit={submit} className="space-y-4">
            {fields[kind].map(field => <label key={field.key} className="block text-sm font-medium text-slate-300">{field.label}
              {field.type === "select" ? <select required value={form[field.key] ?? ""} onChange={e => setForm({ ...form, [field.key]: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100">
                <option value="">Choose…</option>{options(field.key).map(row => <option key={row.id} value={row.id}>{optionLabel(row, field.key)}</option>)}</select> :
                <input required={field.key === "name"} type={field.type ?? "text"} min={field.type === "number" ? 1 : undefined} max={kind === "semesters" ? 8 : undefined} value={form[field.key] ?? ""} onChange={e => setForm({ ...form, [field.key]: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100 placeholder:text-slate-600" placeholder={field.key === "code" ? "Optional" : ""} />}</label>)}
            <div className="flex gap-2 pt-2"><button disabled={busy} className="flex-1 rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy ? "Saving…" : editing ? "Save changes" : "Create record"}</button>
              {(editing || Object.keys(form).length > 0) && <button type="button" onClick={startNew} className="rounded-xl border border-slate-700 px-4 py-3 hover:bg-slate-800">Clear</button>}</div>
          </form>
        </section>
      </div>
      <p className="mt-8 text-xs text-slate-500">This admin page requires the app's database to be configured with DATABASE_URL.</p>
    </div>
  </main>;
}
