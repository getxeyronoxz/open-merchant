import { useEffect, useState } from "react";
import type { ArtifactDescriptor, DesktopClient } from "../../types";

export function ArtifactsScreen({ client, projectRoot }: { client: DesktopClient; projectRoot: string }) {
  const [artifacts, setArtifacts] = useState<ArtifactDescriptor[]>([]);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void client.listArtifacts(projectRoot).then(setArtifacts).catch((reason) => setError(reason instanceof Error ? reason.message : "Artifacts could not be loaded.")); }, [client, projectRoot]);
  const select = async (artifact: ArtifactDescriptor) => { if (!artifact.exists) return; try { setError(null); setContent(await client.readArtifact(projectRoot, artifact.relativePath)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Artifact could not be read."); } };
  return <section className="rounded-xl border border-stone-800 bg-stone-900 p-6"><p className="text-sm font-medium text-emerald-300">Local artifacts</p><h2 className="mt-1 text-2xl font-semibold">Inspect the files your workspace owns</h2><div className="mt-6 grid gap-5 lg:grid-cols-[280px_1fr]"><ul className="rounded-lg border border-stone-800 bg-stone-950/50 p-2">{artifacts.map((artifact) => <li key={artifact.relativePath}><button className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-stone-800 disabled:text-stone-600" disabled={!artifact.exists} onClick={() => void select(artifact)} type="button"><span>{artifact.relativePath.split("/").at(-1)}</span><span className="text-xs">{artifact.exists ? artifact.kind : "Not generated"}</span></button></li>)}</ul><div className="min-h-72 rounded-lg border border-stone-800 bg-stone-950 p-4"><pre className="whitespace-pre-wrap break-words text-sm text-stone-300">{content ?? "Select a local artifact to inspect its text."}</pre>{error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}</div></div></section>;
}
