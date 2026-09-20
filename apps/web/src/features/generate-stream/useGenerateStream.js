"use client";

import { useEffect, useMemo, useState } from "react";
import { streamGenerate } from "../../lib/api/generate";
import { readGenerateCache, writeGenerateCache } from "./generateStreamCache";
import { appendGenerateError, createInitialGenerateState, getLatestStep, reduceGenerateEvent } from "./generateStreamState";

export function useGenerateStream(query) {
  const [state, setState] = useState(() => createInitialGenerateState());

  useEffect(() => {
    const controller = new AbortController();

    if (!query) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) {
          setState(createInitialGenerateState("idle"));
        }
      });
      return () => controller.abort();
    }

    const cached = readGenerateCache(query);
    if (cached) {
      queueMicrotask(() => {
        if (!controller.signal.aborted) {
          setState(cached);
        }
      });
      return () => controller.abort();
    }

    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setState(createInitialGenerateState("loading"));
      }
    });

    streamGenerate(
      { text: query },
      {
        signal: controller.signal,
        onEvent(event) {
          setState((current) => {
            const next = reduceGenerateEvent(current, event);
            writeGenerateCache(query, next);
            return next;
          });
        },
      },
    ).catch((error) => {
      if (controller.signal.aborted) return;
      setState((current) => {
        const next = appendGenerateError(current, error);
        writeGenerateCache(query, next);
        return next;
      });
    });

    return () => controller.abort();
  }, [query]);

  const latestStep = useMemo(() => getLatestStep(state.steps), [state.steps]);

  return { state, latestStep };
}
