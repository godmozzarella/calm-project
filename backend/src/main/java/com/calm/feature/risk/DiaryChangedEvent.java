package com.calm.feature.risk;

/** Recompute mutable labels after a successful diary edit, never the frozen inputs. */
public record DiaryChangedEvent(String userId) {}
