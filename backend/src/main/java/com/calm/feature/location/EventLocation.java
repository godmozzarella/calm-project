package com.calm.feature.location;

import java.time.Instant;

/** Frozen private event location; exact coordinates never enter the shared dataset. */
public record EventLocation(Double latitude, Double longitude, String city, String timezone,
                            String mode, String source, Instant capturedAt) {}
