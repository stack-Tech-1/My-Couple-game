"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/design/Button";
import { TextField } from "@/design/Field";
import { Icon } from "@/design/icons";
import { toast } from "@/design/toast";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { addMemory, answerMemory, deleteMemory } from "@/lib/romantic/actions";
import type { Memory } from "@/lib/romantic/types";
import { isDataSaverOn, photoEdge, useDataSaver } from "@/lib/dataSaver";

const PROMPTS = ["Where were we here?", "What happened right after this?", "What was I laughing at?", "What were we eating?", "What song was playing?", "What year was this?"];

/**
 * Re-encode in the browser: shrinks the upload and drops EXIF metadata (including GPS
 * location), since a canvas only carries pixels.
 */
async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, photoEdge(isDataSaverOn()) / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85));
}

export function MemoryLane({ memories }: { memories: Memory[] }) {
  const { bundle } = useRoom();
  const [adding, setAdding] = useState(memories.length === 0);

  return (
    <div className="flex flex-col gap-8">
      {adding ? <AddMemory onDone={() => setAdding(false)} /> : <Button variant="accent" icon="camera" className="self-start" onClick={() => setAdding(true)}>Add a memory</Button>}
      {memories.length === 0 ? null : (
        <ol className="relative flex flex-col gap-10 before:absolute before:bottom-4 before:left-1/2 before:top-4 before:hidden before:w-px before:bg-line @2xl:before:block">
          {memories.map((m, i) => (
            <li key={m.id} className={i % 2 ? "@2xl:pl-[52%]" : "@2xl:pr-[52%]"}>
              <Polaroid memory={m} me={bundle.me.profile.id} partnerName={bundle.partner?.profile.display_name ?? "Your partner"} tilt={i % 2 ? 1.5 : -1.5} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function AddMemory({ onDone }: { onDone: () => void }) {
  const { bundle } = useRoom();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(PROMPTS[0]!);
  const [takenOn, setTakenOn] = useState("");
  const [pending, start] = useTransition();

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return void toast.error("That's not a photo.", "JPEG, PNG or WebP, please.");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    start(async () => {
      try {
        const blob = await prepareImage(file);
        const path = `${bundle.room.id}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabaseBrowser().storage.from("memories").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        const res = await addMemory({ path, prompt, takenOn: takenOn || null });
        if (!res.ok) return void toast.error(res.error);
        toast.success("Added to Memory Lane.");
        router.refresh();
        onDone();
      } catch {
        toast.error("Couldn't upload that photo.", "Try a smaller one, or check your connection.");
      }
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-[20px] border-[1.5px] border-line-strong bg-raised p-5 @xl:grid-cols-[14rem_1fr]">
      <button type="button" onClick={() => input.current?.click()} className="flex aspect-square items-center justify-center overflow-hidden rounded-[12px] border-[1.5px] border-dashed border-line bg-sunk text-muted hover:border-line-strong" aria-label={file ? "Change photo" : "Choose a photo"}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-[0.9rem]">
            <Icon name="camera" size={28} /> Choose a photo
          </span>
        )}
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} tabIndex={-1} aria-hidden />
      <div className="flex flex-col gap-4">
        <TextField label="Ask your partner" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={200} />
        <div className="flex flex-wrap gap-2">
          {PROMPTS.map((p) => (
            <button key={p} type="button" onClick={() => setPrompt(p)} className="rounded-full border border-line px-3 py-1 text-[0.8rem] hover:border-line-strong">
              {p}
            </button>
          ))}
        </div>
        <TextField label="When was it? (optional)" type="date" value={takenOn} onChange={(e) => setTakenOn(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
        <p className="text-[0.8rem] text-muted">Photos stay private to your room. We strip location data before uploading.</p>
        <div className="flex gap-3">
          <Button type="submit" variant="accent" loading={pending} disabled={!file || !prompt.trim()}>
            Add to the timeline
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}

function Polaroid({ memory: m, me, partnerName, tilt }: { memory: Memory; me: string; partnerName: string; tilt: number }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [pending, start] = useTransition();
  const mine = m.author_id === me;
  const canAnswer = !mine && !m.answer;
  const { active: saver } = useDataSaver();
  const [reveal, setReveal] = useState(false);

  return (
    <motion.figure initial={{ opacity: 0, y: 20, rotate: 0 }} whileInView={{ opacity: 1, y: 0, rotate: tilt }} viewport={{ once: true, margin: "-40px" }} className="relative bg-[#fbf7f1] p-3 pb-5 text-ink shadow-[0_18px_40px_-24px_rgba(28,20,22,.55)]">
      <div className="aspect-[4/3] overflow-hidden bg-sunk">
        {m.url && saver && !reveal ? (
          <button type="button" onClick={() => setReveal(true)} className="flex h-full w-full flex-col items-center justify-center gap-1 text-[0.85rem] font-semibold text-[#57474a]">
            Photo
            <span className="font-normal">Data saver is on. Tap to load.</span>
          </button>
        ) : m.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, must not be proxied or cached
          <img src={m.url} alt={m.prompt} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[0.85rem] text-muted">Photo unavailable</div>
        )}
      </div>
      <figcaption className="mt-4 px-1">
        <p className="text-[0.75rem] text-[#57474a]">
          {mine ? "You asked" : `${partnerName} asked`}
          {m.taken_on ? ` · ${new Date(m.taken_on).toLocaleDateString(undefined, { month: "long", year: "numeric" })}` : ""}
        </p>
        <p className="display mt-1 text-[1.4rem] leading-tight">{m.prompt}</p>
        <AnimatePresence mode="wait">
          {m.answer ? (
            <motion.p key="a" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="display mt-3 text-[1.2rem] italic text-[#5b1a2b]">
              “{m.answer}”
            </motion.p>
          ) : canAnswer ? (
            <motion.form
              key="f"
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const r = await answerMemory(m.id, answer);
                  if (!r.ok) return void toast.error(r.error);
                  router.refresh();
                });
              }}
            >
              <label htmlFor={`ans-${m.id}`} className="sr-only">
                Your answer
              </label>
              <input id={`ans-${m.id}`} value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={1000} placeholder="I remember…" className="h-11 min-w-0 flex-1 rounded-full border-[1.5px] border-[#dfd2c1] bg-white px-4 text-ink focus:border-ink focus:outline-none" />
              <Button type="submit" size="sm" loading={pending} disabled={!answer.trim()} className="h-11">
                Answer
              </Button>
            </motion.form>
          ) : (
            <p className="mt-3 text-[0.9rem] text-[#57474a]">Waiting for {partnerName} to remember…</p>
          )}
        </AnimatePresence>
      </figcaption>
      {mine ? (
        <button
          type="button"
          aria-label="Remove this memory"
          className="absolute right-4 top-4 rounded-full bg-[rgba(28,20,22,.55)] p-1.5 text-white hover:bg-[rgba(28,20,22,.8)]"
          onClick={() => void deleteMemory(m.id).then((r) => (r.ok ? router.refresh() : toast.error(r.error)))}
        >
          <Icon name="close" size={14} />
        </button>
      ) : null}
    </motion.figure>
  );
}
