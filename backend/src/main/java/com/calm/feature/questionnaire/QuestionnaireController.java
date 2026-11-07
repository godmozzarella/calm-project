package com.calm.feature.questionnaire;
import com.calm.security.AuthenticatedUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
@RestController
@RequestMapping("/questionnaire")
public class QuestionnaireController {
    private final QuestionnaireService service;
    public QuestionnaireController(QuestionnaireService service) { this.service = service; }
    @GetMapping public QuestionnaireService.Status status(@AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam String timezone) { return service.status(user.getUserId(), timezone); }
    @GetMapping("/profile") public QuestionnaireProfile profile(@AuthenticationPrincipal AuthenticatedUser user) {
        return service.profile(user.getUserId());
    }
    @PutMapping("/profile") public QuestionnaireProfile profile(@AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody QuestionnaireProfile profile) { return service.profile(user.getUserId(), profile); }
    @PostMapping public QuestionnaireService.Result submit(@AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody Submission body) { return service.submit(user.getUserId(), body.date(), body.timezone(), body.answers()); }
    public record Submission(LocalDate date, String timezone, DailyQuestionnaire.Answers answers) {}
}
