package com.calm.feature.location;

import com.calm.feature.user.User;
import com.calm.feature.user.UserRepository;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;

@Service
public class EventLocationService {
    private final UserRepository users;
    public EventLocationService(UserRepository users) { this.users = users; }

    public EventLocation capture(String userId, LocalDate date, LocalTime time) {
        return users.findById(userId).map(user -> resolve(user, date, time)).orElse(null);
    }

    public static EventLocation resolve(User user, LocalDate date, LocalTime time) {
        ZoneId zone;
        try { zone = ZoneId.of(user.getLocationTimezone()); } catch (Exception e) { zone = ZoneOffset.UTC; }
        if ("MANUAL".equals(user.getLocationMode())) {
            if (user.getLatitude() == null || user.getLongitude() == null) return null;
            return new EventLocation(user.getLatitude(), user.getLongitude(), user.getCity(), user.getLocationTimezone(),
                "MANUAL", date != null && date.isBefore(LocalDate.now(zone)) ? "MANUAL_PROFILE_ASSUMPTION" : "CONFIRMED_MANUAL", Instant.now());
        }
        Instant event = date == null ? Instant.now() : date.atTime(time == null ? LocalTime.NOON : time).atZone(zone).toInstant();
        var history = user.getLocationHistory().stream()
                .filter(entry -> entry != null && entry.effectiveAt() != null && entry.location() != null)
                .sorted(Comparator.comparing(LocationHistoryEntry::effectiveAt)).toList();
        LocationHistoryEntry chosen = null;
        for (var entry : history) if (!entry.effectiveAt().isAfter(event)) chosen = entry;
        String source = "LOCATION_HISTORY";
        if (chosen == null && !history.isEmpty()) { chosen = history.get(0); source = "INITIAL_PROFILE_ASSUMPTION"; }
        EventLocation location = chosen == null
                ? new EventLocation(user.getLatitude(), user.getLongitude(), user.getCity(), user.getLocationTimezone(),
                        user.getLocationMode(), "PROFILE_ASSUMPTION", Instant.now()) : chosen.location();
        if (location.latitude() == null || location.longitude() == null) return null;
        if (chosen == null || (location.source() != null && location.source().contains("ASSUMPTION"))) source = location.source();
        return new EventLocation(location.latitude(), location.longitude(), location.city(), location.timezone(),
                location.mode(), source, Instant.now());
    }
}
