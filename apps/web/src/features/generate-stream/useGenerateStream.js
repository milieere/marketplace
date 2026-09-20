"use client";

import { useEffect, useMemo, useState } from "react";
import { streamGenerate } from "../../lib/api/generate";
import { appendGenerateError, createInitialGenerateState, getLatestStep, reduceGenerateEvent } from "./generateStreamState";

export function useGenerateStream(query) {
  const [state, setState] = useState(() => createInitialGenerateState());

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setState(createInitialGenerateState(query ? "loading" : "idle"));
      }
    });

    if (!query) {
      return () => controller.abort();
    }

    streamGenerate(
      { text: query },
      {
        signal: controller.signal,
        onEvent(event) {
          setState((current) => reduceGenerateEvent(current, event));
        },
      },
    ).catch((error) => {
      if (controller.signal.aborted) return;
      setState((current) => appendGenerateError(current, error));
    });

    return () => controller.abort();
  }, [query]);

  const latestStep = useMemo(() => getLatestStep(state.steps), [state.steps]);

  return { state, latestStep };
}
