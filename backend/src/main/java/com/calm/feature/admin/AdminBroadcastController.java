package com.calm.feature.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/broadcast")
public class AdminBroadcastController {
	private final AdminBroadcastService broadcastService;

	public AdminBroadcastController(AdminBroadcastService broadcastService) {
		this.broadcastService = broadcastService;
	}

	@GetMapping("/audience")
	public AudienceResponse audience() {
		return new AudienceResponse(broadcastService.countRecipients());
	}

	@PostMapping
	public AdminBroadcastService.BroadcastResult send(@Valid @RequestBody BroadcastRequest request) {
		return broadcastService.send(request.subject(), request.message(), request.expectedRecipientCount(), request.requestId());
	}

	public record AudienceResponse(long recipientCount) {}

	public record BroadcastRequest(
			@NotBlank @Size(max = 160) @Pattern(regexp = "^[^\\r\\n]+$") String subject,
			@NotBlank @Size(max = 10000) String message,
			@NotNull @Min(0) Long expectedRecipientCount,
            @NotBlank @Pattern(regexp = "[a-f0-9]{32}") String requestId
	) {}
}
