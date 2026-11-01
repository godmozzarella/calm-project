package com.calm.feature.location;
import java.time.Instant;
public record LocationHistoryEntry(Instant effectiveAt, EventLocation location) {}
