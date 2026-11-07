package com.calm.feature.questionnaire;

import com.calm.feature.risk.AccountDeletedEvent;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CycleMarkerServiceTest {
    private final CycleMarkerRepository repo = mock(CycleMarkerRepository.class);
    private final QuestionnaireProfileRepository profiles = mock(QuestionnaireProfileRepository.class);
    private final Map<String, CycleMarker> saved = new HashMap<>();
    private final LocalDate today = LocalDate.of(2026, 11, 3);
    private final CycleMarkerService service = new CycleMarkerService(repo, profiles,
            Clock.fixed(Instant.parse("2026-11-03T09:00:00Z"), ZoneOffset.UTC));

    @BeforeEach void setup() {
        when(profiles.findById("alice")).thenReturn(Optional.of(new QuestionnaireProfile("alice", QuestionnaireProfile.Sex.FEMALE, null, false)));
        when(repo.findById(anyString())).thenAnswer(i -> Optional.ofNullable(saved.get(i.getArgument(0))));
        when(repo.save(any(CycleMarker.class))).thenAnswer(i -> {
            CycleMarker marker = i.getArgument(0); saved.put(marker.id(), marker); return marker;
        });
        when(repo.findByUserIdOrderByDateAsc("alice")).thenAnswer(i -> saved.values().stream()
                .filter(marker -> marker.userId().equals("alice")).sorted(Comparator.comparing(CycleMarker::date)).toList());
        doAnswer(i -> { saved.remove(i.getArgument(0)); return null; }).when(repo).deleteById(anyString());
    }

    @Test void ownPastMarkersCanBeCorrectedAndAreIdempotent() {
        service.put("alice", today.minusDays(4), CycleMarker.Kind.DAY, "Europe/Moscow");
        service.put("alice", today, CycleMarker.Kind.DAY, "Europe/Moscow");
        service.put("alice", today, CycleMarker.Kind.DAY, "Europe/Moscow");
        assertThat(service.list("alice")).containsExactly(
                new CycleMarkerService.Marker(today.minusDays(4), CycleMarker.Kind.DAY),
                new CycleMarkerService.Marker(today, CycleMarker.Kind.DAY));
        verify(repo, times(2)).save(any(CycleMarker.class));
        service.remove("alice", today, CycleMarker.Kind.DAY, "Europe/Moscow");
        assertThat(service.list("alice")).hasSize(1);
    }

    @Test void oldStartAndEndBecomeEditableIndividualDays() {
        var start=today.minusDays(2);
        saved.put(CycleMarker.key("alice",start,CycleMarker.Kind.START),new CycleMarker(CycleMarker.key("alice",start,CycleMarker.Kind.START),"alice",start,CycleMarker.Kind.START,Instant.parse("2026-11-01T09:00:00Z")));
        saved.put(CycleMarker.key("alice",today,CycleMarker.Kind.END),new CycleMarker(CycleMarker.key("alice",today,CycleMarker.Kind.END),"alice",today,CycleMarker.Kind.END,Instant.parse("2026-11-03T09:00:00Z")));
        assertThat(service.list("alice").stream().filter(m -> m.kind()==CycleMarker.Kind.DAY)).extracting(CycleMarkerService.Marker::date)
                .containsExactly(start,start.plusDays(1),today);
        service.remove("alice",start.plusDays(1),CycleMarker.Kind.DAY,"Europe/Moscow");
        assertThat(service.list("alice").stream().filter(m -> m.kind()==CycleMarker.Kind.DAY)).extracting(CycleMarkerService.Marker::date)
                .containsExactly(start,today);
        assertThat(saved.values()).anyMatch(m -> m.kind()==CycleMarker.Kind.CLOSED && m.date().equals(today));
        assertThat(saved.values()).noneMatch(m -> m.kind()==CycleMarker.Kind.START || m.kind()==CycleMarker.Kind.END);
    }

    @Test void onlyFemaleProfileCanEditAndFutureDaysCanBeSelected() {
        assertThatThrownBy(() -> service.put("other", today, CycleMarker.Kind.DAY, "Europe/Moscow"))
                .hasMessageContaining("женском поле");
        var future=today.plusDays(14);
        service.put("alice", future, CycleMarker.Kind.DAY, "Europe/Moscow");
        assertThat(service.list("alice")).containsExactly(new CycleMarkerService.Marker(future,CycleMarker.Kind.DAY));
        service.remove("alice", future, CycleMarker.Kind.DAY, "Europe/Moscow");
        assertThat(service.list("alice")).isEmpty();
        assertThatThrownBy(() -> service.put("alice", today, CycleMarker.Kind.DAY, "bad-zone"))
                .hasMessageContaining("часовой пояс");
        verify(repo, times(1)).save(any(CycleMarker.class));
    }

    @Test void calendarCanConfirmAndReopenEndOnlyOnSelectedPastDay() {
        var start=today.minusDays(2);
        service.put("alice",start,CycleMarker.Kind.DAY,"Europe/Moscow");
        service.put("alice",today,CycleMarker.Kind.DAY,"Europe/Moscow");
        service.put("alice",today,CycleMarker.Kind.CLOSED,"Europe/Moscow");
        assertThat(service.list("alice")).contains(new CycleMarkerService.Marker(today,CycleMarker.Kind.CLOSED));
        service.remove("alice",today,CycleMarker.Kind.CLOSED,"Europe/Moscow");
        assertThat(service.list("alice")).doesNotContain(new CycleMarkerService.Marker(today,CycleMarker.Kind.CLOSED));
        assertThatThrownBy(() -> service.put("alice",today.plusDays(1),CycleMarker.Kind.CLOSED,"Europe/Moscow"))
                .hasMessageContaining("прошедший день");
    }

    @Test void accountDeletionRemovesPrivateMarkers() {
        service.deleted(new AccountDeletedEvent("alice"));
        verify(repo).deleteByUserId("alice");
    }
}
