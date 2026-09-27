import { useCallback, useEffect, useState } from "react";

import { updateStatusSchema, type UpdateStatus } from "@open-merchant/shared";
import { Button } from "@open-merchant/ui";

import { client } from "../../client";

import { updateBannerMode } from "./updateBannerMode";

/**
 * The update strip: always present, honest, and quiet when it can be.
 *
 * It used to be a banner that existed only once something had downloaded, so
 * "you are on the newest release", "we could not reach the feed", and "no
 * release exists yet" were all the same absence. Now the strip is always there
 * and says which of those is true, escalating a failed check rather than
 * rendering it as calm news — a problem you have to go looking for is a problem
 * you never find.
 *
 * Main pushes contract-validated events on the one-way "update:status" channel
 * and also answers `update/check`, so the strip is correct on a window that was
 * already open when the first check finished. Absent in browser dev, where
 * there is no bridge and nothing to update.
 */
export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const subscribe = window.openMerchant?.onUpdateStatus;
    if (!subscribe) return undefined;
    return subscribe((payload) => {
      const parsed = updateStatusSchema.safeParse(payload);
      if (parsed.success) setStatus(parsed.data);
    });
  }, []);

  // The version names what "up to date" and "could not check" are up to date
  // *from*. Without it those two sentences are assertions with nothing behind
  // them.
  useEffect(() => {
    let cancelled = false;
    void client.appInfo().then((info) => {
      if (!cancelled) setVersion(info.appVersion);
    });
    void client.checkForUpdates().then((result) => {
      if (!cancelled) setStatus(result.status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const checkNow = useCallback(async () => {
    setBusy(true);
    try {
      const result = await client.checkForUpdates();
      setStatus(result.status);
      setDismissed(false);
    } finally {
      setBusy(false);
    }
  }, []);

  if (!status || (dismissed && status.state !== "downloaded")) return null;

  const mode = updateBannerMode(status, version === "" ? "this build" : version);
  if (!mode.urgent) {
    // All well: a quiet, single line. Present, so "up to date" is something
    // the app can say rather than something you infer from silence.
    return (
      <div aria-label="Updates" className="update-strip update-strip--quiet" role="status">
        <span>{mode.message}</span>
        <Button disabled={busy} onClick={() => void checkNow()} variant="ghost">
          {busy ? "Checking…" : "Check now"}
        </Button>
      </div>
    );
  }

  return (
    <div
      aria-label="Updates"
      className={`update-strip update-strip--${mode.tone}`}
      role={mode.tone === "urgent" ? "alert" : "status"}
    >
      <div className="update-strip__copy">
        <span>{mode.message}</span>
      </div>
      <div className="update-strip__actions">
        {mode.offersRestart ? (
          <Button
            onClick={async () => {
              // Main quits and swaps the binary; nothing to render afterwards.
              await client.installUpdate();
            }}
            variant="primary"
          >
            Restart now
          </Button>
        ) : null}
        <Button disabled={busy} onClick={() => void checkNow()} variant="ghost">
          {busy ? "Checking…" : "Check now"}
        </Button>
        {mode.offersRestart ? (
          <Button onClick={() => setDismissed(true)} variant="ghost">
            Not now
          </Button>
        ) : null}
      </div>
    </div>
  );
}
