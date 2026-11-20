package com.calm.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitFilterTest {
	@Test
	void directClientsCannotBypassIpLimitWithForwardedHeader() throws Exception {
		var filter = new RateLimitFilter(1, 60, false);
		assertThat(send(filter, "192.0.2.1", "192.0.2.10").getStatus()).isEqualTo(200);
		var limited = send(filter, "192.0.2.1", "192.0.2.11");
		assertThat(limited.getStatus()).isEqualTo(429);
		assertThat(limited.getHeader("Retry-After")).isNotBlank();
		assertThat(send(filter, "192.0.2.2", "192.0.2.10").getStatus()).isEqualTo(200);
	}

	private static MockHttpServletResponse send(RateLimitFilter filter, String ip, String forwarded) throws Exception {
		var request = new MockHttpServletRequest("POST", "/auth/email/request");
		request.setServletPath("/auth/email/request");
		request.setRemoteAddr(ip);
		request.addHeader("X-Forwarded-For", forwarded);
		var response = new MockHttpServletResponse();
		filter.doFilter(request, response, new MockFilterChain());
		return response;
	}
}
