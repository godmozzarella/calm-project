package com.calm.feature.forecast;

import com.calm.feature.forecast.provider.NoaaKpService;
import com.calm.feature.forecast.provider.WeatherProvider;
import com.calm.feature.forecast.provider.WeatherProviderRegistry;
import com.calm.feature.forecast.snapshot.ForecastSnapshot;
import com.calm.feature.forecast.snapshot.ForecastSnapshotService;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ForecastServiceFallbackTest {
    private final WeatherProviderRegistry providers = mock(WeatherProviderRegistry.class);
    private final WeatherProvider provider = mock(WeatherProvider.class);
    private final ForecastSnapshotService snapshots = mock(ForecastSnapshotService.class);
    private final ForecastService service = new ForecastService(providers, mock(NoaaKpService.class), snapshots);

    private void unavailableProvider() {
        when(providers.active()).thenReturn(provider);
        when(provider.fetchForecast(anyDouble(), anyDouble(), eq(3)))
                .thenThrow(new IllegalStateException("temporary timeout"));
    }

    @Test void returnsSavedTodayAsStaleAndDoesNotRetryForEveryDayCard() {
        unavailableProvider();
        var saved = new ForecastSnapshot();
        saved.setDate(LocalDate.now(ZoneOffset.UTC));
        saved.setTimezone("UTC");
        saved.setScore(42);
        saved.setRisk(RiskLevel.MEDIUM);
        saved.setPressureMmHg(748.0);
        saved.setCreatedAt(Instant.now().minusSeconds(3600));
        when(snapshots.findInRange(eq(55.75), eq(37.62), any(), any())).thenReturn(List.of(saved));

        var first = service.getForecast(55.75, 37.62);
        var second = service.getForecast(55.75, 37.62);

        assertThat(first.stale()).isTrue();
        assertThat(first.cachedAt()).isEqualTo(saved.getCreatedAt());
        assertThat(first.days()).hasSize(1);
        assertThat(first.days().get(0).score()).isEqualTo(42);
        assertThat(first.days().get(0).pressureMmHg()).isEqualTo(748.0);
        assertThat(second.stale()).isTrue();
        verify(provider, times(1)).fetchForecast(55.75, 37.62, 3);
    }

    @Test void oldDayAloneCannotMasqueradeAsTodayAndUnavailableIs503() {
        unavailableProvider();
        var yesterday = new ForecastSnapshot();
        yesterday.setDate(LocalDate.now(ZoneOffset.UTC).minusDays(1));
        yesterday.setTimezone("UTC");
        when(snapshots.findInRange(eq(55.75), eq(37.62), any(), any())).thenReturn(List.of(yesterday));

        assertThatThrownBy(() -> service.getForecast(55.75, 37.62))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode().value()).isEqualTo(503));
    }
}
