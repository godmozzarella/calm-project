package com.calm.feature.questionnaire;

import com.calm.security.AuthenticatedUser;
import java.time.LocalDate;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/questionnaire/cycle")
public class CycleMarkerController {
    private final CycleMarkerService service;
    public CycleMarkerController(CycleMarkerService service) { this.service = service; }

    @GetMapping public List<CycleMarkerService.Marker> list(@AuthenticationPrincipal AuthenticatedUser user) {
        return service.list(user.getUserId());
    }

    @PutMapping("/{date}/{kind}") public CycleMarkerService.Marker put(@AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable LocalDate date, @PathVariable CycleMarker.Kind kind, @RequestParam String timezone) {
        return service.put(user.getUserId(), date, kind, timezone);
    }

    @DeleteMapping("/{date}/{kind}") public void remove(@AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable LocalDate date, @PathVariable CycleMarker.Kind kind, @RequestParam String timezone) {
        service.remove(user.getUserId(), date, kind, timezone);
    }
}
