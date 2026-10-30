"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".ppt", ".pptx", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".gif", ".webp"];
const RESOURCE_TYPES = [
  { value: "NOTES", label: "Notes" },
  { value: "PDF", label: "PDF" },
  { value: "PPT", label: "Presentation" },
  { value: "LAB_MANUAL", label: "Lab manual" },
  { value: "ASSIGNMENT", label: "Assignment" },
  { value: "IMPORTANT_QUESTIONS", label: "Important questions" },
  { value: "REVISION_MATERIAL", label: "Revision material" },
];

type UnitOption = { id: string; name: string; number: number };

export default function ResourceUploadForm({ subjectId, units }: { subjectId: string; units: UnitOption[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [unitId, setUnitId] = useState("");
  const [type, setType] = useState("NOTES");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const file = fileInput.current?.files?.[0];
    if (!file) return setError("Choose a file to upload.");
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(extension)) return setError("Only PDF, PPT, DOC, and image files are supported.");
    if (file.size > MAX_FILE_SIZE) return setError("The file must be 10 MB or smaller.");
    if (!title.trim()) return setError("Enter a title for this resource.");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    formData.append("subjectId", subjectId);
    formData.append("unitId", unitId);
    formData.append("type", type);

    setUploading(true);
    setProgress(0);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/resources");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      setUploading(false);
      let response: { error?: string } = {};
      try { response = JSON.parse(xhr.responseText) as { error?: string }; } catch { /* non-JSON response */ }
      if (xhr.status < 200 || xhr.status >= 300) {
        setError(response.error ?? "Upload failed. Please try again.");
        return;
      }
      setSuccess("Resource uploaded successfully.");
      setTitle("");
      setUnitId("");
      setType("NOTES");
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    };
    xhr.onerror = () => {
      setUploading(false);
      setError("Network error while uploading. Please try again.");
    };
    xhr.send(formData);
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-semibold">Upload a resource</h2>
      <p className="mt-1 text-sm text-zinc-600">PDF, PPT, DOC, or image · maximum 10 MB</p>
      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <label className="grid gap-1.5 text-sm font-medium">
          Resource title
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required
            placeholder="e.g. Unit 1 lecture notes"
            className="rounded-lg border border-zinc-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Resource type
          <select value={type} onChange={(event) => setType(event.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
            {RESOURCE_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Unit (optional)
          <select value={unitId} onChange={(event) => setUnitId(event.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
            <option value="">Whole subject</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>Unit {unit.number}: {unit.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          File
          <input ref={fileInput} type="file" accept=".pdf,.ppt,.pptx,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp" required
            className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5" />
        </label>
        {uploading && (
          <div className="sm:col-span-2" aria-live="polite">
            <div className="mb-1 flex justify-between text-sm text-zinc-600"><span>Uploading resource…</span><span>{progress}%</span></div>
            <div role="progressbar" aria-label="File upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}
              className="h-2 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {error && <p role="alert" className="sm:col-span-2 text-sm text-red-700">{error}</p>}
        {success && <p role="status" className="sm:col-span-2 text-sm text-green-700">{success}</p>}
        <div className="sm:col-span-2">
          <button type="submit" disabled={uploading}
            className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
            {uploading ? "Uploading…" : "Upload resource"}
          </button>
        </div>
      </form>
    </section>
  );
}
