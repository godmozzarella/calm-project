package com.calm.feature.location;

import com.calm.feature.user.User;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class EventLocationServiceTest {
    private User user() {
        User user = new User("location@example.test", "User", "hash");
        user.setLocationMode("AUTO");
        user.setLatitude(60.0); user.setLongitude(30.0); user.setCity("B"); user.setLocationTimezone("UTC");
        return user;
    }
    @Test void oldDataWithoutHistoryUsesChosenProfileAndMarksAssumption() {
        var location = EventLocationService.resolve(user(), LocalDate.of(2020, 1, 1), LocalTime.NOON);
        assertThat(location.city()).isEqualTo("B");
        assertThat(location.source()).isEqualTo("PROFILE_ASSUMPTION");
    }
    @Test void resolvesEachEventUsingConfirmedHistoryRatherThanCurrentProfile() {
        var user = user();
        user.setLocationHistory(List.of(
            new LocationHistoryEntry(Instant.parse("2026-10-01T00:00:00Z"), new EventLocation(55.0, 37.0, "A", "UTC", "AUTO", "CONFIRMED_AUTO", Instant.now())),
            new LocationHistoryEntry(Instant.parse("2026-11-01T12:00:00Z"), new EventLocation(60.0, 30.0, "B", "UTC", "AUTO", "CONFIRMED_AUTO", Instant.now()))));
        assertThat(EventLocationService.resolve(user, LocalDate.of(2026, 11, 1), LocalTime.of(9, 0)).city()).isEqualTo("A");
        assertThat(EventLocationService.resolve(user, LocalDate.of(2026, 11, 1), LocalTime.of(15, 0)).city()).isEqualTo("B");
        var retro = EventLocationService.resolve(user, LocalDate.of(2020, 1, 1), LocalTime.NOON);
        assertThat(retro.city()).isEqualTo("A");
        assertThat(retro.source()).isEqualTo("INITIAL_PROFILE_ASSUMPTION");
    }
    @Test void manualSelectionAlwaysAppliesToNewEntriesEvenWhenHistoryContainsOtherCities() {
        var user = user(); user.setLocationMode("MANUAL");
        user.setLocationHistory(List.of(new LocationHistoryEntry(Instant.EPOCH,
            new EventLocation(55.0, 37.0, "A", "UTC", "AUTO", "CONFIRMED_AUTO", Instant.now()))));
        assertThat(EventLocationService.resolve(user, LocalDate.of(2020, 1, 1), LocalTime.NOON).city()).isEqualTo("B");
    }
}
