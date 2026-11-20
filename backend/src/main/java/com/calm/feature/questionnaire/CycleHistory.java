package com.calm.feature.questionnaire;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.BinaryOperator;
import java.util.stream.Collectors;

import static com.calm.feature.questionnaire.CycleMarker.Kind.*;

final class CycleHistory {
    record Period(LocalDate start, LocalDate end, LocalDate lastMarked, String startSource, String endSource,
            boolean planned) {}
    record Statistics(double cycleLength, long spread, double periodLength, String confidence, int validIntervals) {}
    record Timeline(List<Period> periods, Statistics statistics) {
        List<Period> actual() { return periods.stream().filter(period -> !period.planned()).toList(); }
        Period latest() { return actual().stream().reduce((previous, current) -> current).orElse(null); }
    }

    private CycleHistory() {}

    static Timeline from(List<CycleMarker> markers, LocalDate today, Instant asOf) {
        var known = markers.stream().filter(marker -> !marker.recordedAt().isAfter(asOf)).toList();
        var selected = CycleMarkerService.knownDays(known.stream().filter(marker -> !CycleMarkerService.legacyPlan(marker)).toList(), asOf);
        var starts = byDate(known, BEGIN, START);
        var ends = byDate(known, CLOSED, END);
        var linkedEnds = ends.values().stream().filter(marker -> marker.periodStart() != null)
                .collect(Collectors.toMap(CycleMarker::periodStart, CycleMarker::date,
                        (earlier, later) -> earlier.isAfter(later) ? later : earlier));
        var dayMarks = byDate(known, DAY);
        var periods = new ArrayList<Period>();
        Period open = null;
        for (var day : selected.keySet().stream().filter(date -> !date.isAfter(today)).sorted().toList()) {
            if (open == null || starts.containsKey(day) || !day.equals(open.lastMarked().plusDays(1))
                    && day.isAfter(linkedEnds.getOrDefault(open.start(), open.lastMarked()))) {
                if (open != null) periods.add(open);
                var first = starts.getOrDefault(day, dayMarks.get(day));
                open = new Period(day, null, day, source(first), null, false);
            }
            var ending = ends.get(day);
            open = new Period(open.start(), ending == null ? null : day, day, open.startSource(),
                    ending == null ? null : source(ending), false);
            if (ending != null) {
                periods.add(open);
                open = null;
            }
        }
        if (open != null) periods.add(open);
        var actual = List.copyOf(periods);
        known.stream().filter(marker -> marker.kind() == PLANNED || CycleMarkerService.legacyPlan(marker)
                || marker.kind() == DAY && marker.date().isAfter(today))
                .collect(Collectors.toMap(CycleMarker::date, marker -> marker, BinaryOperator.maxBy(
                        java.util.Comparator.comparing(CycleMarker::recordedAt))))
                .values().forEach(marker -> periods.add(new Period(marker.date(), marker.plannedEnd(),
                        marker.plannedEnd() == null ? marker.date() : marker.plannedEnd(),
                        source(marker), null, true)));
        periods.sort(java.util.Comparator.comparing(Period::start));
        return new Timeline(List.copyOf(periods), statistics(actual));
    }

    private static Map<LocalDate, CycleMarker> byDate(List<CycleMarker> markers, CycleMarker.Kind... kinds) {
        var selected = List.of(kinds);
        return markers.stream().filter(marker -> selected.contains(marker.kind()))
                .collect(Collectors.toMap(CycleMarker::date, marker -> marker,
                        BinaryOperator.maxBy(java.util.Comparator.comparing(CycleMarker::recordedAt))));
    }

    private static String source(CycleMarker marker) {
        return marker == null || marker.source() == null ? "CALENDAR" : marker.source();
    }

    private static Statistics statistics(List<Period> periods) {
        var intervals = new ArrayList<Long>();
        for (int index = 1; index < periods.size(); index++) {
            long days = ChronoUnit.DAYS.between(periods.get(index - 1).start(), periods.get(index).start());
            if (days >= 15 && days <= 90) intervals.add(days);
        }
        var recent = intervals.subList(Math.max(0, intervals.size() - 6), intervals.size()).stream().sorted().toList();
        int middle = recent.size() / 2;
        double median = recent.isEmpty() ? 28 : (recent.get((recent.size() - 1) / 2) + recent.get(middle)) / 2.0;
        long spread = recent.isEmpty() ? 7 : recent.getLast() - recent.getFirst();
        double duration = periods.stream().filter(period -> period.end() != null)
                .mapToLong(period -> ChronoUnit.DAYS.between(period.start(), period.end()) + 1)
                .average().orElse(5);
        int count = intervals.size();
        return new Statistics(median, spread, duration, count < 2 ? "LOW" : count < 4 ? "MEDIUM" : "HIGH", count);
    }
}
