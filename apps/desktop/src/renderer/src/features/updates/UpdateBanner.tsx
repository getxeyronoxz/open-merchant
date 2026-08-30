import { useEffect, useState } from "react";

import { updateStatusSchema, type UpdateStatus } from "@open-merchant/shared";
import { Button } from "@open-merchant/ui";

import { client } from "../../client";

/**
 * Non-blocking update notice. Main pushes contract-validated events on the
 * one-way "update:status" channel; when a downloaded version is ready, this
 * offers Restart now — dismissing keeps working, and the update still
 * installs on quit. Absent in browser dev (no bridge, no updates).
 */
export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const subscribe = window.openMerchant?.onUpdateStatus;
    if (!subscribe) return undefined;
    return subscribe((payload) => {
      const parsed = updateStatusSchema.safeParse(payload);
      if (parsed.success) setStatus(parsed.data);
    });
  }, []);

  if (!status || status.state !== "downloaded" || dismissed) return null;

  const install = async (): Promise<void> => {
    await client.installUpdate();
    // Main quits and swaps the binary; nothing to render afterwards.
  };

  return (
    <div className="update-banner" role="status">
      <div className="update-banner__copy">
        <strong>Open Merchant {status.version} is ready</strong>
        <span>Downloaded in the background. Restart now to apply it, or keep working — it installs on quit.</span>
      </div>
      <div className="update-banner__actions">
        <Button variant="primary" onClick={() => void install()}>
          Restart now
        </Button>
        <Button variant="ghost" onClick={() => setDismissed(true)}>
          Not now
        </Button>
      </div>
    </div>
  );
}
