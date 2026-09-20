"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ingestPack, ingestUpload } from "../../lib/api/brands";
import { appendIngestError, createInitialIngestState, reduceIngestEvent } from "./brandIngestState";

export function useBrandIngest() {
  const [state, setState] = useState(() => createInitialIngestState());
  const controller = useRef(null);

  // The API listens to the request signal and stops the agent when it aborts
  const stop = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    (request) => {
      stop();
      const next = new AbortController();
      controller.current = next;
      setState(createInitialIngestState("streaming"));

      const options = {
        signal: next.signal,
        onEvent(event) {
          setState((current) => reduceIngestEvent(current, event));
        },
      };

      const run = request.files ? ingestUpload(request, options) : ingestPack(request.brandId, options);
      run.catch((error) => {
        if (next.signal.aborted) return;
        setState((current) => appendIngestError(current, error));
      });
    },
    [stop],
  );

  const cancel = useCallback(() => {
    stop();
    setState((current) => ({ ...current, status: "cancelled" }));
  }, [stop]);

  const reset = useCallback(() => {
    stop();
    setState(createInitialIngestState());
  }, [stop]);

  return { state, start, cancel, reset };
}
