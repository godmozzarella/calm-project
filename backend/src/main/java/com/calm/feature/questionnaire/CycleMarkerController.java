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
    private final CyclePromptService prompts;
    public CycleMarkerController(CycleMarkerService service, CyclePromptService prompts) {
        this.service = service;
        this.prompts = prompts;
    }

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

    @GetMapping("/overview") public CyclePromptService.Overview overview(@AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam String timezone) {
        return prompts.overview(user.getUserId(), timezone);
    }

    @PutMapping("/range") public void range(@AuthenticationPrincipal AuthenticatedUser user, @RequestParam String timezone,
            @RequestBody Range body) {
        service.range(user.getUserId(), body.start(), body.end(), timezone);
    }

    @PostMapping("/question") public CyclePromptService.Question question(@AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam String timezone) {
        return prompts.claim(user.getUserId(), timezone);
    }

    @PostMapping("/answer") public void answer(@AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam String timezone, @RequestBody CyclePromptService.Answer answer) {
        prompts.answer(user.getUserId(), timezone, answer);
    }

    public record Range(LocalDate start, LocalDate end) {}
}
